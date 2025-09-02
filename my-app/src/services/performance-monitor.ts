// Performance monitoring service
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
    // Monitor navigation timing
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

      // Monitor resource timing
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

      // Monitor largest contentful paint
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        this.recordMetric("lcp", lastEntry.startTime);
      });
      lcpObserver.observe({ entryTypes: ["largest-contentful-paint"] });
      this.observers.push(lcpObserver);

      // Monitor first input delay
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          const fidEntry = entry as any;
          this.recordMetric("fid", fidEntry.processingStart - fidEntry.startTime);
        });
      });
      fidObserver.observe({ entryTypes: ["first-input"] });
      this.observers.push(fidObserver);

      // Monitor cumulative layout shift
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

    // Keep only last 100 measurements
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

  // Web Vitals monitoring
  measureWebVitals() {
    // Core Web Vitals
    this.measureLCP();
    this.measureFID();
    this.measureCLS();

    // Additional metrics
    this.measureTTFB();
    this.measureFCP();
  }

  private measureLCP() {
    if ("PerformanceObserver" in window) {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        console.log("LCP:", lastEntry.startTime);
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
          console.log("FID:", fid);
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
        console.log("CLS:", clsScore);
      });
      observer.observe({ entryTypes: ["layout-shift"] });
    }
  }

  private measureTTFB() {
    if ("performance" in window && "getEntriesByType" in performance) {
      const navEntry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
      if (navEntry) {
        const ttfb = navEntry.responseStart - navEntry.requestStart;
        console.log("TTFB:", ttfb);
      }
    }
  }

  private measureFCP() {
    if ("PerformanceObserver" in window) {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          console.log("FCP:", entry.startTime);
        });
      });
      observer.observe({ entryTypes: ["paint"] });
    }
  }

  // Bundle size monitoring
  async measureBundleSize() {
    try {
      await retry(async () => {
        if ("navigator" in window && "connection" in navigator) {
          const connection = (navigator as any).connection;
          if (connection) {
            console.log("Connection type:", connection.effectiveType);
            console.log("Downlink speed:", connection.downlink);
          }
        }
        // Monitor resource sizes
        const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
        let totalSize = 0;
        resources.forEach((resource) => {
          if (resource.transferSize) {
            totalSize += resource.transferSize;
          }
        });
        console.log("Total resource size:", totalSize);
      });
    } catch (error) {
      throw formatServiceError(error, "Failed to measure bundle size");
    }
  }

  // Memory usage monitoring
  measureMemoryUsage() {
    try {
      if ("memory" in performance) {
        const memory = (performance as any).memory;
        console.log("Memory usage:", {
          used: memory.usedJSHeapSize,
          total: memory.totalJSHeapSize,
          limit: memory.jsHeapSizeLimit,
        });
      }
    } catch (error) {
      throw formatServiceError(error, "Failed to measure memory usage");
    }
  }

  // Performance recommendations
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

  // Export metrics for analysis
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

  // Cleanup
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
