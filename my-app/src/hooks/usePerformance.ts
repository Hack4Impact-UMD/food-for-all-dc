import React, { memo, useCallback, useMemo } from "react";

// Higher-order component for performance optimization
export function withPerformanceOptimization<P extends object>(
  Component: React.ComponentType<P>,
  propsAreEqual?: (prevProps: P, nextProps: P) => boolean
) {
  const MemoizedComponent = memo(Component, propsAreEqual);
  MemoizedComponent.displayName = `withPerformanceOptimization(${Component.displayName || Component.name})`;
  return MemoizedComponent;
}

// Custom hook for stable callback references
export function useStableCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: React.DependencyList
): T {
  return useCallback(callback, deps);
}

// Custom hook for expensive computations
export function useExpensiveComputation<T>(compute: () => T, deps: React.DependencyList): T {
  return useMemo(compute, deps);
}

// Performance monitoring hook
export function usePerformanceMonitor(componentName: string) {
  const renderStart = useMemo(() => performance.now(), []);

  React.useEffect(() => {
    const renderEnd = performance.now();
    const renderTime = renderEnd - renderStart;

    if (renderTime > 16) {
      // More than one frame (16ms)
      // console.warn(`${componentName} render took ${renderTime.toFixed(2)}ms`);
    }
  });
}

// Debounce hook for performance
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Intersection Observer hook for lazy loading
export function useIntersectionObserver(
  ref: React.RefObject<Element>,
  options: IntersectionObserverInit = {}
): boolean {
  const [isIntersecting, setIsIntersecting] = React.useState(false);

  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
    }, options);

    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, options]);

  return isIntersecting;
}
