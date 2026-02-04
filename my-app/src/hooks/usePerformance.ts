import React, { memo, useCallback, useMemo } from "react";

export function withPerformanceOptimization<P extends object>(
  Component: React.ComponentType<P>,
  propsAreEqual?: (prevProps: P, nextProps: P) => boolean
) {
  const MemoizedComponent = memo(Component, propsAreEqual);
  MemoizedComponent.displayName = `withPerformanceOptimization(${Component.displayName || Component.name})`;
  return MemoizedComponent;
}

export function useStableCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: React.DependencyList
): T {
  return useCallback(callback, [callback, ...deps]);
}

export function useExpensiveComputation<T>(compute: () => T, deps: React.DependencyList): T {
  return useMemo(compute, [compute, ...deps]);
}

export function usePerformanceMonitor(componentName: string) {
  const renderStart = useMemo(() => performance.now(), []);

  React.useEffect(() => {
    const renderEnd = performance.now();
    const renderTime = renderEnd - renderStart;

    void componentName;
    void renderTime;
  });
}

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
