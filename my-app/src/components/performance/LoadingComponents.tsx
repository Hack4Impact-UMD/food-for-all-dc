import React, { useState, useEffect } from "react";
import { withPerformanceOptimization } from "../../hooks/usePerformance";
import { ConditionalRender } from "../performance";

const CHUNK_RELOAD_STORAGE_KEY = "ffaChunkReloadError";
const CHUNK_RELOAD_RESET_DELAY_MS = 10000;

export const isChunkLoadError = (error: Error): boolean =>
  /ChunkLoadError|Loading chunk \d+ failed|Failed to fetch dynamically imported module/i.test(
    `${error.name} ${error.message}`
  );

export const shouldReloadForChunkError = (
  error: Error,
  storage: Pick<Storage, "getItem" | "setItem">
): boolean => {
  if (!isChunkLoadError(error)) return false;
  if (storage.getItem(CHUNK_RELOAD_STORAGE_KEY) === error.message) return false;

  storage.setItem(CHUNK_RELOAD_STORAGE_KEY, error.message);
  return true;
};

// Enhanced loading component with progressive loading states
const ProgressiveLoader = withPerformanceOptimization(
  ({
    isLoading,
    loadingText = "Loading...",
    showProgress = false,
    progress = 0,
    children,
    timeout = 10000,
  }: {
    isLoading: boolean;
    loadingText?: string;
    showProgress?: boolean;
    progress?: number;
    children: React.ReactNode;
    timeout?: number;
  }) => {
    const [showTimeout, setShowTimeout] = useState(false);

    useEffect(() => {
      if (isLoading) {
        const timer = setTimeout(() => {
          setShowTimeout(true);
        }, timeout);

        return () => clearTimeout(timer);
      } else {
        setShowTimeout(false);
      }
    }, [isLoading, timeout]);

    if (!isLoading) {
      return <>{children}</>;
    }

    return (
      <div className="progressive-loader">
        <div className="loading-spinner" />
        <p>{loadingText}</p>
        <ConditionalRender condition={showProgress}>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </ConditionalRender>
        <ConditionalRender condition={showTimeout}>
          <p className="timeout-message">
            This is taking longer than expected. Please check your connection.
          </p>
        </ConditionalRender>
      </div>
    );
  }
);

// Skeleton loader for better perceived performance
const SkeletonLoader = withPerformanceOptimization(
  ({
    lines = 3,
    height = 20,
    width = "100%",
  }: {
    lines?: number;
    height?: number;
    width?: string | number;
  }) => {
    return (
      <div className="skeleton-loader">
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={index}
            className="skeleton-line"
            style={{
              height,
              width: typeof width === "string" ? width : `${width}px`,
              marginBottom: "8px",
              backgroundColor: "var(--color-border-lighter)",
              borderRadius: "4px",
              animation: "skeleton-pulse 1.5s ease-in-out infinite",
            }}
          />
        ))}
      </div>
    );
  }
);

// Error boundary with retry functionality
class ErrorBoundaryComponent extends React.Component<
  {
    children: React.ReactNode;
    fallback?: React.ComponentType<{ error: Error; resetError: () => void }>;
    onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  },
  { hasError: boolean; error?: Error }
> {
  private chunkReloadResetTimer?: number;

  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidMount() {
    this.chunkReloadResetTimer = window.setTimeout(() => {
      try {
        window.sessionStorage.removeItem(CHUNK_RELOAD_STORAGE_KEY);
      } catch {
        // Storage can be unavailable in privacy-restricted browser contexts.
      }
    }, CHUNK_RELOAD_RESET_DELAY_MS);
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error caught by boundary:", error, errorInfo);
    this.props.onError?.(error, errorInfo);

    if (isChunkLoadError(error)) {
      window.clearTimeout(this.chunkReloadResetTimer);
      try {
        if (shouldReloadForChunkError(error, window.sessionStorage)) {
          window.location.reload();
        }
      } catch {
        // Keep the fallback visible when storage is unavailable; reloading here could loop.
      }
    }
  }

  componentWillUnmount() {
    window.clearTimeout(this.chunkReloadResetTimer);
  }

  resetError = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      return <FallbackComponent error={this.state.error!} resetError={this.resetError} />;
    }

    return this.props.children;
  }
}

const DefaultErrorFallback = ({ error, resetError }: { error: Error; resetError: () => void }) => {
  const chunkLoadFailed = isChunkLoadError(error);

  return (
    <div className="error-fallback">
      <h2>Something went wrong</h2>
      <p>{error.message}</p>
      <button onClick={chunkLoadFailed ? () => window.location.reload() : resetError}>
        {chunkLoadFailed ? "Reload page" : "Try again"}
      </button>
    </div>
  );
};

const ErrorBoundary = withPerformanceOptimization(ErrorBoundaryComponent);

// Performance-optimized image component
const OptimizedImage = withPerformanceOptimization(
  ({
    src,
    alt,
    width,
    height,
    className,
    loading = "lazy",
    placeholder,
  }: {
    src: string;
    alt: string;
    width?: number;
    height?: number;
    className?: string;
    loading?: "lazy" | "eager";
    placeholder?: string;
  }) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);

    return (
      <div className={`optimized-image ${className || ""}`}>
        <ConditionalRender condition={!isLoaded && !hasError}>
          <SkeletonLoader lines={1} height={height || 200} width={width || "100%"} />
        </ConditionalRender>

        <ConditionalRender condition={hasError}>
          <div className="image-error">
            <span>Failed to load image</span>
          </div>
        </ConditionalRender>

        <img
          src={src}
          alt={alt}
          width={width}
          height={height}
          loading={loading}
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
          style={{
            display: isLoaded ? "block" : "none",
            transition: "opacity 0.3s ease",
          }}
        />
      </div>
    );
  }
);

export { ProgressiveLoader, SkeletonLoader, ErrorBoundary, OptimizedImage };
