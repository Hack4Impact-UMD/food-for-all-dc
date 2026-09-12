// Pure helpers behind the field mapper.
//
// Kept out of the component so the fiddly parts - reading order, splitting a
// field that drives several boxes, deciding what a field is probably for - can
// be tested directly.

import type {
  TefapAcroField,
  TefapAnnotation,
  TefapFormField,
  TefapPdfInspection,
  TefapRect,
} from "../../types/tefap-types";
import { TEFAP_CLIENT_FIELD_SOURCES } from "../../utils/tefapPrefill";

/** Strips punctuation and case so two labels can be compared loosely. */
const normalize = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, "");

const CLIENT_SOURCE_TOKENS = TEFAP_CLIENT_FIELD_SOURCES.map((source) => ({
  key: source.key,
  tokens: [normalize(source.key), normalize(source.label)],
}));

/**
 * Words that mark a field as belonging to somebody other than the client: a
 * proxy, an alternate contact, an emergency contact. A label carrying one must
 * not be bound to the client's own details.
 */
const THIRD_PARTY_QUALIFIERS = [
  "proxy",
  "alternate",
  "alternative",
  "emergency",
  "spouse",
  "guardian",
  "caregiver",
  "representative",
  "authorized",
  "designee",
  "witness",
];

/**
 * Guesses which client value a field is asking for, from its label alone.
 *
 * Deliberately conservative, because a plausible wrong guess is worse than no
 * guess: the admin has to notice it to undo it, and an unnoticed one puts the
 * client's own details into a section meant for somebody else.
 *
 * Two rules, neither tied to a particular form:
 *  - an exact match on a client value's name, or
 *  - a label that wholly contains one ("Client Ward Number" -> ward).
 *
 * The reverse containment is rejected: a label that is merely a fragment of a
 * client value's name ("Name" inside "Full name") is weak evidence, and forms
 * routinely use bare labels like that for a proxy or alternate contact. Names
 * ending in a digit are skipped for the same reason, since that is how form
 * editors label the second copy of a duplicated block.
 *
 * Where several client values match, the longest token wins rather than the
 * first: the registry lists the primary phone before the alternate, so a
 * first-match rule binds "Alternate Phone Number" to the client's own phone.
 */
export const suggestClientKey = (label: string): string | undefined => {
  const field = normalize(label);
  if (field.length < 3) return undefined;

  for (const source of CLIENT_SOURCE_TOKENS) {
    if (source.tokens.includes(field)) return source.key;
  }

  if (/\d$/.test(field)) return undefined;

  let best: { key: string; token: string } | undefined;

  for (const source of CLIENT_SOURCE_TOKENS) {
    for (const token of source.tokens) {
      if (token.length < 4 || !field.includes(token)) continue;
      if (!best || token.length > best.token.length) {
        best = { key: source.key, token };
      }
    }
  }

  if (!best) return undefined;

  // The qualifier is allowed only when the matched value accounts for it
  // itself, as "Alternate phone" does for "Alternate Phone Number". Otherwise
  // the label is asking about a different person and gets no suggestion.
  const qualifier = THIRD_PARTY_QUALIFIERS.find((word) => field.includes(word));
  if (qualifier && !best.token.includes(qualifier)) return undefined;

  return best.key;
};

const fieldTypeFor = (acro: TefapAcroField): TefapFormField["type"] => {
  if (acro.type === "checkbox") return "checkbox";
  if (acro.type === "radio") return "radio";
  return "text";
};

const isUninformativeCheckboxName = (name: string): boolean =>
  /^(undefined|untitled|field|check\s?box|button|no)[\s_-]*\d*$/i.test(name.trim());

const overlayPlacement = (rect: TefapRect): TefapFormField["placement"] => ({
  kind: "overlay",
  page: rect.page,
  x: rect.x,
  y: rect.y,
  width: rect.width,
  height: rect.height,
  fontSize: Math.max(Math.min(rect.width, rect.height), 6),
  align: "center",
});

/** Top-left-first reading order, so the list matches how the page scans. */
const readingOrder = (left: TefapRect, right: TefapRect): number => {
  if (left.page !== right.page) return left.page - right.page;
  // PDF y grows upward, so a larger y is higher on the page.
  if (Math.abs(left.y - right.y) > 4) return right.y - left.y;
  return left.x - right.x;
};

/**
 * Every box a field draws. A field with more than one is the shared-widget
 * defect, and drawing all of them is what makes that visible on the preview:
 * the admin sees one number sitting on two unrelated rows.
 */
const rectsOf = (field: TefapFormField, inspection: TefapPdfInspection): TefapRect[] => {
  if (field.radioOptions) {
    return field.radioOptions.flatMap((option) => {
      const placement = option.placement;
      if (placement.kind === "overlay") return [{ ...placement }];
      return (
        inspection.acroFields.find(
          (entry) => entry.name === placement.pdfFieldName
        )?.widgets ?? []
      );
    });
  }

  if (field.placement.kind === "overlay") {
    return [{ ...field.placement }];
  }

  const acro = inspection.acroFields.find(
    (entry) => entry.name === (field.placement as { pdfFieldName: string }).pdfFieldName
  );

  return acro?.widgets ?? [];
};

const anchorOf = (field: TefapFormField, inspection: TefapPdfInspection): TefapRect =>
  rectsOf(field, inspection)[0] ?? { page: 1, x: 0, y: 0, width: 0, height: 0 };

/**
 * Seeds a field map from an inspected PDF: one entry per AcroForm field, in
 * reading order, with any value already saved in the template offered as a
 * static prefill.
 */
export const buildFieldsFromInspection = (inspection: TefapPdfInspection): TefapFormField[] => {
  const entries = inspection.acroFields
    .filter((acro) => acro.type !== "unsupported")
    .map((acro) => ({
      acro,
      anchor: acro.widgets[0] ?? { page: 1, x: 0, y: 0, width: 0, height: 0 },
    }))
    .sort((left, right) => readingOrder(left.anchor, right.anchor));

  const availableNoWidgets = entries
    .filter(
      ({ acro }) => acro.type === "checkbox" && isUninformativeCheckboxName(acro.name)
    )
    .flatMap(({ acro }) => acro.widgets.map((widget) => ({ acro, widget })));
  const claimedNoWidgets = new Set<TefapRect>();
  const noWidgetByYesField = new Map<TefapAcroField, TefapRect>();

  for (const { acro } of entries) {
    if (
      acro.type !== "checkbox" ||
      isUninformativeCheckboxName(acro.name) ||
      acro.widgets.length !== 1
    ) {
      continue;
    }

    const yes = acro.widgets[0];
    const match = availableNoWidgets
      .filter(({ widget }) => {
        const sameRow = Math.abs(widget.y - yes.y) <= Math.max(4, yes.height, widget.height);
        const horizontalGap = widget.x - (yes.x + yes.width);
        return (
          !claimedNoWidgets.has(widget) &&
          widget.page === yes.page &&
          sameRow &&
          horizontalGap >= 0 &&
          horizontalGap <= 80
        );
      })
      .sort((left, right) => left.widget.x - right.widget.x)[0];

    if (match) {
      claimedNoWidgets.add(match.widget);
      noWidgetByYesField.set(acro, match.widget);
    }
  }

  const fullyPairedNoFields = new Set(
    availableNoWidgets
      .map(({ acro }) => acro)
      .filter((acro) => acro.widgets.every((widget) => claimedNoWidgets.has(widget)))
  );

  for (const [yesField, noWidget] of noWidgetByYesField) {
    const noField = availableNoWidgets.find(({ widget }) => widget === noWidget)?.acro;
    if (!noField || !fullyPairedNoFields.has(noField)) {
      noWidgetByYesField.delete(yesField);
    }
  }

  return entries
    .filter(({ acro }) => !fullyPairedNoFields.has(acro))
    .map(({ acro }, index) => {
    const savedValue = typeof acro.currentValue === "string" ? acro.currentValue.trim() : "";
    const suggested = suggestClientKey(acro.name);
    const noWidget = noWidgetByYesField.get(acro);

    return {
      key: `f${index + 1}_${normalize(acro.name).slice(0, 24) || "field"}`,
      label: acro.name,
      type: noWidget ? "radio" : fieldTypeFor(acro),
      options: noWidget ? ["Yes", "No"] : acro.type === "radio" ? acro.options : undefined,
      radioOptions: noWidget
        ? [
            {
              value: "Yes",
              placement: { kind: "acroform", pdfFieldName: acro.name },
            },
            { value: "No", placement: overlayPlacement(noWidget) },
          ]
        : undefined,
      required: false,
      placement: { kind: "acroform", pdfFieldName: acro.name },
      // A value already stored in the template is the author's own default and
      // is almost always wanted, so it wins over a guessed client binding.
      prefill: savedValue
        ? { source: "static", staticValue: savedValue }
        : suggested
          ? { source: "client", clientKey: suggested }
          : { source: "none" },
      order: index,
      hidden: false,
      readOnly: false,
    };
    });
};

/** Boxes to draw on the preview, numbered to match the mapping list. */
export const annotationsForFields = (
  fields: TefapFormField[],
  inspection: TefapPdfInspection,
  selectedKey?: string
): TefapAnnotation[] =>
  fields.flatMap((field, index) =>
    rectsOf(field, inspection)
      .filter((rect) => rect.width > 0 && rect.height > 0)
      .map((rect) => ({
        ...rect,
        label: String(index + 1),
        highlighted: field.key === selectedKey,
      }))
  );

/** Field names this inspection flagged under a given diagnostic. */
export const diagnosticFieldNames = (
  inspection: TefapPdfInspection,
  code: TefapPdfInspection["diagnostics"][number]["code"]
): string[] => inspection.diagnostics.find((entry) => entry.code === code)?.fieldNames ?? [];

