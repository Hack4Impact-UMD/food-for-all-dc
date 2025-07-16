import React, { Suspense } from 'react';
import { withPerformanceOptimization } from '../../hooks/usePerformance';

// Lazy loading container with error boundaries
const LazyLoadContainer = withPerformanceOptimization(
  ({ children, fallback = <div>Loading...</div> }: { 
    children: React.ReactNode;
    fallback?: React.ReactNode;
  }) => {
    return (
      <Suspense fallback={fallback}>
        {children}
      </Suspense>
    );
  }
);

// Virtualized list item for large datasets
interface VirtualizedListItemProps {
  index: number;
  style: React.CSSProperties;
  data: any[];
  ItemComponent: React.ComponentType<any>;
}

const VirtualizedListItem = withPerformanceOptimization(
  ({ 
    index, 
    style, 
    data, 
    ItemComponent 
  }: VirtualizedListItemProps) => {
    return (
      <div style={style}>
        <ItemComponent {...data[index]} />
      </div>
    );
  },
  (prevProps: VirtualizedListItemProps, nextProps: VirtualizedListItemProps) => {
    return (
      prevProps.index === nextProps.index &&
      prevProps.data[prevProps.index] === nextProps.data[nextProps.index]
    );
  }
);

// Conditional render component to prevent unnecessary renders
interface ConditionalRenderProps {
  condition: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

const ConditionalRender = withPerformanceOptimization(
  ({ 
    condition, 
    children, 
    fallback = null 
  }: ConditionalRenderProps) => {
    return condition ? <>{children}</> : <>{fallback}</>;
  },
  (prevProps: ConditionalRenderProps, nextProps: ConditionalRenderProps) => prevProps.condition === nextProps.condition
);

// Image component with lazy loading
const LazyImage = withPerformanceOptimization(
  ({ 
    src, 
    alt, 
    className,
    placeholder = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2VlZSIvPjwvc3ZnPg=='
  }: {
    src: string;
    alt: string;
    className?: string;
    placeholder?: string;
  }) => {
    const [imageSrc, setImageSrc] = React.useState(placeholder);
    const [isLoaded, setIsLoaded] = React.useState(false);

    React.useEffect(() => {
      const img = new Image();
      img.onload = () => {
        setImageSrc(src);
        setIsLoaded(true);
      };
      img.src = src;
    }, [src]);

    return (
      <img 
        src={imageSrc} 
        alt={alt} 
        className={`${className} ${isLoaded ? 'loaded' : 'loading'}`}
        style={{ 
          transition: 'opacity 0.3s ease',
          opacity: isLoaded ? 1 : 0.7
        }}
      />
    );
  }
);

export {
  LazyLoadContainer,
  VirtualizedListItem,
  ConditionalRender,
  LazyImage
};
