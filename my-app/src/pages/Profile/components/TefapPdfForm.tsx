import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Box, Typography } from "@mui/material";
import { Document, Page, pdfjs } from "react-pdf";
import type { PDFDocumentProxy } from "pdfjs-dist";
import "react-pdf/dist/Page/AnnotationLayer.css";
import type {
  TefapFieldPlacement,
  TefapFormField,
  TefapPdfInspection,
} from "../../../types/tefap-types";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

interface TefapPdfFormProps {
  bytes: Uint8Array;
  inspection: TefapPdfInspection;
  fields: TefapFormField[];
  values: Map<string, string | boolean>;
  onChange: (key: string, value: string | boolean) => void;
}

interface NativeAnnotation {
  id: string;
  page: number;
  fieldName?: string;
  buttonValue?: string;
  rect?: number[];
}

interface NativeTarget {
  field: TefapFormField;
  option?: string;
}

const rectMatchesPlacement = (
  annotation: NativeAnnotation,
  placement: TefapFieldPlacement
): boolean => {
  if (placement.kind === "acroform") {
    return annotation.fieldName === placement.pdfFieldName;
  }

  if (annotation.page !== placement.page || !annotation.rect || annotation.rect.length < 4) {
    return false;
  }

  const [x1, y1, x2, y2] = annotation.rect;
  const tolerance = 2;
  return (
    Math.abs(x1 - placement.x) <= tolerance &&
    Math.abs(y1 - placement.y) <= tolerance &&
    Math.abs(x2 - (placement.x + placement.width)) <= tolerance &&
    Math.abs(y2 - (placement.y + placement.height)) <= tolerance
  );
};

const targetForAnnotation = (
  annotation: NativeAnnotation,
  fields: TefapFormField[]
): NativeTarget | undefined => {
  for (const field of fields) {
    const radioOption = field.radioOptions?.find((option) =>
      rectMatchesPlacement(annotation, option.placement)
    );
    if (radioOption) return { field, option: radioOption.value };
    if (rectMatchesPlacement(annotation, field.placement)) {
      return {
        field,
        option: field.type === "radio" ? annotation.buttonValue : undefined,
      };
    }
  }
  return undefined;
};

const TefapPdfForm: React.FC<TefapPdfFormProps> = ({
  bytes,
  inspection,
  fields,
  values,
  onChange,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const documentRef = useRef<PDFDocumentProxy | null>(null);
  const annotationsRef = useRef<Map<string, NativeAnnotation>>(new Map());
  const fieldsRef = useRef(fields);
  const valuesRef = useRef(values);
  const onChangeRef = useRef(onChange);
  const [containerWidth, setContainerWidth] = useState(720);
  const [annotationsReady, setAnnotationsReady] = useState(false);
  const pdfData = useMemo(() => ({ data: bytes.slice() }), [bytes]);

  fieldsRef.current = fields;
  valuesRef.current = values;
  onChangeRef.current = onChange;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateWidth = () => setContainerWidth(Math.max(container.clientWidth - 2, 280));
    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const applyFieldState = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    for (const [id, annotation] of annotationsRef.current) {
      const target = targetForAnnotation(annotation, fieldsRef.current);
      const element = container.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
        `[data-element-id="${CSS.escape(id)}"]`
      );
      const section = element?.closest<HTMLElement>("section");

      if (!target) {
        if (section) section.hidden = true;
        if (element) element.disabled = true;
        continue;
      }

      if (section) section.hidden = target.field.hidden === true;
      if (!element) continue;

      const readOnly = target.field.readOnly === true;
      if (element instanceof HTMLInputElement && element.type !== "checkbox" && element.type !== "radio") {
        element.readOnly = readOnly;
      } else if (element instanceof HTMLTextAreaElement) {
        element.readOnly = readOnly;
      } else {
        element.disabled = readOnly;
      }
      element.setAttribute("aria-readonly", String(readOnly));
      element.dataset.tefapMapped = "true";
      element.dataset.tefapReadOnly = String(readOnly);
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !annotationsReady) return;

    applyFieldState();
    const observer = new MutationObserver(applyFieldState);
    observer.observe(container, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [annotationsReady, applyFieldState]);

  const seedAnnotationStorage = useCallback(() => {
    const document = documentRef.current;
    if (!document) return;

    for (const [id, annotation] of annotationsRef.current) {
      const target = targetForAnnotation(annotation, fieldsRef.current);
      if (!target) continue;

      const value = valuesRef.current.get(target.field.key);
      if (target.field.type === "radio") {
        const option = target.option ?? annotation.buttonValue;
        document.annotationStorage.setValue(id, { value: value === option });
      } else if (target.field.type === "checkbox") {
        document.annotationStorage.setValue(id, { value: value === true });
      } else {
        document.annotationStorage.setValue(id, { value: String(value ?? "") });
      }
    }
  }, []);

  const handleDocumentLoad = useCallback(async (document: PDFDocumentProxy) => {
    documentRef.current = document;
    setAnnotationsReady(false);

    const pages = await Promise.all(
      Array.from({ length: document.numPages }, async (_, index) => {
        const pageNumber = index + 1;
        const page = await document.getPage(pageNumber);
        const annotations = (await page.getAnnotations({ intent: "display" })) as NativeAnnotation[];
        return annotations.map((annotation) => ({ ...annotation, page: pageNumber }));
      })
    );

    annotationsRef.current = new Map(
      pages.flat().filter((annotation) => annotation.id).map((annotation) => [annotation.id, annotation])
    );
    seedAnnotationStorage();
    setAnnotationsReady(true);
  }, [seedAnnotationStorage]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleNativeInput = (event: Event) => {
      const element = event.target;
      if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement)) {
        return;
      }

      const id = element.dataset.elementId;
      const annotation = id ? annotationsRef.current.get(id) : undefined;
      if (!annotation) return;

      const target = targetForAnnotation(annotation, fieldsRef.current);
      if (!target || target.field.hidden || target.field.readOnly) return;

      if (target.field.type === "radio") {
        if (!(element instanceof HTMLInputElement) || !element.checked) return;
        const option = target.option ?? annotation.buttonValue ?? element.value;
        onChangeRef.current(target.field.key, option);

        for (const [otherId, otherAnnotation] of annotationsRef.current) {
          const otherTarget = targetForAnnotation(otherAnnotation, fieldsRef.current);
          if (otherTarget?.field.key !== target.field.key || otherId === id) continue;
          const otherElement = container.querySelector<HTMLInputElement>(
            `[data-element-id="${CSS.escape(otherId)}"]`
          );
          if (otherElement) otherElement.checked = false;
          documentRef.current?.annotationStorage.setValue(otherId, { value: false });
        }
      } else if (target.field.type === "checkbox" && element instanceof HTMLInputElement) {
        onChangeRef.current(target.field.key, element.checked);
      } else {
        onChangeRef.current(target.field.key, element.value);
      }
    };

    container.addEventListener("input", handleNativeInput);
    container.addEventListener("change", handleNativeInput);
    return () => {
      container.removeEventListener("input", handleNativeInput);
      container.removeEventListener("change", handleNativeInput);
    };
  }, []);

  return (
    <Box
      ref={containerRef}
      sx={{
        width: "100%",
        "& .annotationLayer .textWidgetAnnotation [data-tefap-mapped='true']": {
          clipPath: "inset(0 0 28% 0)",
        },
        "& .annotationLayer [data-tefap-read-only='true']": {
          background: "rgba(224, 224, 224, 0.82) !important",
          borderColor: "transparent !important",
          color: "var(--color-text-medium-alt2) !important",
          cursor: "not-allowed !important",
        },
      }}
    >
      <Document
        file={pdfData}
        onLoadSuccess={handleDocumentLoad}
        loading={<Typography sx={{ py: 4, textAlign: "center" }}>Loading form...</Typography>}
        error={<Alert severity="error">The PDF could not be displayed.</Alert>}
      >
        {annotationsReady && (
          <Box sx={{ display: "grid", gap: 2, justifyContent: "center" }}>
            {inspection.pageSizes.map((pageSize) => {
              const pageWidth = Math.min(containerWidth, 820);

              return (
                <Box
                  key={pageSize.page}
                  sx={{
                    width: pageWidth,
                    maxWidth: "100%",
                    boxShadow: "var(--shadow-sm)",
                    backgroundColor: "var(--color-white)",
                  }}
                >
                  <Page
                    pageNumber={pageSize.page}
                    width={pageWidth}
                    renderAnnotationLayer
                    renderForms
                    renderTextLayer={false}
                    onRenderAnnotationLayerSuccess={applyFieldState}
                  />
                </Box>
              );
            })}
          </Box>
        )}
      </Document>
    </Box>
  );
};

export default TefapPdfForm;
