import { retry } from "../utils/retry";
import { ServiceError, formatServiceError } from "../utils/serviceError";

class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, number[]> = new Map();
  private observers: PerformanceObserver[] = [];

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  constructor() {
    this.initializeObservers();
  }

  private initializeObservers() {
    if ("PerformanceObserver" in window) {
      const navObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.entryType === "navigation") {
            const navEntry = entry as PerformanceNavigationTiming;
            this.recordMetric(
              "navigation.domContentLoaded",
              navEntry.domContentLoadedEventEnd - navEntry.domContentLoadedEventStart
            );
            this.recordMetric(
              "navigation.loadComplete",
              navEntry.loadEventEnd - navEntry.loadEventStart
            );
          }
        });
      });
      navObserver.observe({ entryTypes: ["navigation"] });
      this.observers.push(navObserver);

      const resourceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.entryType === "resource") {
            const resourceEntry = entry as PerformanceResourceTiming;
            this.recordMetric(`resource.${resourceEntry.name}`, resourceEntry.duration);
          }
        });
      });
      resourceObserver.observe({ entryTypes: ["resource"] });
      this.observers.push(resourceObserver);

      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        this.recordMetric("lcp", lastEntry.startTime);
      });
      lcpObserver.observe({ entryTypes: ["largest-contentful-paint"] });
      this.observers.push(lcpObserver);

      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          const fidEntry = entry as any;
          this.recordMetric("fid", fidEntry.processingStart - fidEntry.startTime);
        });
      });
      fidObserver.observe({ entryTypes: ["first-input"] });
      this.observers.push(fidObserver);

      const clsObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        let clsScore = 0;
        entries.forEach((entry) => {
          if (!(entry as any).hadRecentInput) {
            clsScore += (entry as any).value;
          }
        });
        this.recordMetric("cls", clsScore);
      });
      clsObserver.observe({ entryTypes: ["layout-shift"] });
      this.observers.push(clsObserver);
    }
  }

  recordMetric(name: string, value: number) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(value);

    const values = this.metrics.get(name)!;
    if (values.length > 100) {
      values.shift();
    }
  }

  getMetrics(): Record<string, { average: number; latest: number; count: number }> {
    const result: Record<string, { average: number; latest: number; count: number }> = {};

    this.metrics.forEach((values, name) => {
      if (values.length > 0) {
        const sum = values.reduce((acc, val) => acc + val, 0);
        result[name] = {
          average: sum / values.length,
          latest: values[values.length - 1],
          count: values.length,
        };
      }
    });

    return result;
  }

  measureWebVitals() {
    this.measureLCP();
    this.measureFID();
    this.measureCLS();
    this.measureTTFB();
    this.measureFCP();
  }

  private measureLCP() {
    if ("PerformanceObserver" in window) {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        if (lastEntry) {
          this.recordMetric("lcp", lastEntry.startTime);
        }
      });
      observer.observe({ entryTypes: ["largest-contentful-paint"] });
    }
  }

  private measureFID() {
    if ("PerformanceObserver" in window) {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          const fidEntry = entry as any;
          const fid = fidEntry.processingStart - fidEntry.startTime;
          this.recordMetric("fid", fid);
        });
      });
      observer.observe({ entryTypes: ["first-input"] });
    }
  }

  private measureCLS() {
    if ("PerformanceObserver" in window) {
      let clsScore = 0;
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (!(entry as any).hadRecentInput) {
            clsScore += (entry as any).value;
          }
        });
        this.recordMetric("cls", clsScore);
      });
      observer.observe({ entryTypes: ["layout-shift"] });
    }
  }

  private measureTTFB() {
    if ("performance" in window && "getEntriesByType" in performance) {
      const navEntry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
      if (navEntry) {
        const ttfb = navEntry.responseStart - navEntry.requestStart;
        this.recordMetric("ttfb", ttfb);
      }
    }
  }

  private measureFCP() {
    if ("PerformanceObserver" in window) {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.name === "first-contentful-paint") {
            this.recordMetric("fcp", entry.startTime);
          }
        });
      });
      observer.observe({ entryTypes: ["paint"] });
    }
  }

  async measureBundleSize() {
    try {
      await retry(async () => {
        const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
        let totalSize = 0;
        resources.forEach((resource) => {
          if (resource.transferSize) {
            totalSize += resource.transferSize;
          }
        });
        this.recordMetric("bundleSize", totalSize);
      });
    } catch (error) {
      throw formatServiceError(error, "Failed to measure bundle size");
    }
  }

  measureMemoryUsage() {
    try {
      if ("memory" in performance) {
        const memory = (performance as any).memory;
        if (memory.usedJSHeapSize) {
          this.recordMetric("memoryUsage", memory.usedJSHeapSize);
        }
      }
    } catch (error) {
      throw formatServiceError(error, "Failed to measure memory usage");
    }
  }

  getRecommendations(): string[] {
    try {
      const recommendations: string[] = [];
      const metrics = this.getMetrics();
      if (metrics.lcp && metrics.lcp.latest > 2500) {
        recommendations.push("LCP is slow - consider optimizing images and critical resources");
      }
      if (metrics.fid && metrics.fid.latest > 100) {
        recommendations.push("FID is high - consider reducing JavaScript execution time");
      }
      if (metrics.cls && metrics.cls.latest > 0.1) {
        recommendations.push("CLS is high - ensure elements have defined dimensions");
      }
      return recommendations;
    } catch (error) {
      throw formatServiceError(error, "Failed to get performance recommendations");
    }
  }

  exportMetrics(): string {
    try {
      const metrics = this.getMetrics();
      const recommendations = this.getRecommendations();
      return JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          metrics,
          recommendations,
          userAgent: navigator.userAgent,
          url: window.location.href,
        },
        null,
        2
      );
    } catch (error) {
      throw formatServiceError(error, "Failed to export performance metrics");
    }
  }

  destroy() {
    try {
      this.observers.forEach((observer) => observer.disconnect());
      this.observers = [];
      this.metrics.clear();
    } catch (error) {
      throw formatServiceError(error, "Failed to destroy performance monitor");
    }
  }
}

export default PerformanceMonitor;
