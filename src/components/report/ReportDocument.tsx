import path from 'node:path';
import { Document, Font, Page, StyleSheet, Text, View, Link, Image } from '@react-pdf/renderer';
import type { ReportModel } from '@/lib/report/model';

/**
 * The PDF. Same model as the on-screen sheet, different primitives.
 *
 * react-pdf has no DOM and no CSS cascade, so this cannot literally share JSX
 * with ReportSheet. What it shares is ReportModel — every figure and every
 * string is decided once, upstream. Layout is allowed to differ here; content
 * is not, and that is the drift the PRD is actually guarding against.
 *
 * Colours are literal rather than tokens: a PDF has no theme. These are the
 * light-theme values, which is correct — the document prints on white.
 *
 * One A4 page is a requirement. A flex row cannot split across pages, so the
 * guideline tables sit in a single three-column row and the compliance items
 * in a strip beneath it: that is what keeps the whole report on one sheet.
 */
const C = {
  ink: '#0a0a0a',
  inkSecondary: '#525252',
  inkTertiary: '#707070',
  border: '#ebebeb',
  sunken: '#fafafa',
  pass: '#05803b',
} as const;

// No hyphenation: "fur-niture" in a comp card reads as a typo on a financial document.
Font.registerHyphenationCallback((word) => [word]);

const MAP_WIDTH = 130;
const LOSS_CARD_WIDTH = 160;

const s = StyleSheet.create({
  page: { paddingVertical: 26, paddingHorizontal: 40, fontSize: 8.5, color: C.ink, fontFamily: 'Helvetica' },

  masthead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    borderBottomWidth: 1, borderBottomColor: C.ink, paddingBottom: 8, marginBottom: 10 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  brandName: { fontSize: 11, fontFamily: 'Helvetica-Bold' },
  meta: { flexDirection: 'row', gap: 20 },
  metaLabel: { fontSize: 7, color: C.inkTertiary, marginBottom: 2 },
  metaValue: { fontSize: 9, fontFamily: 'Helvetica-Bold' },

  preamble: { fontSize: 7, color: C.inkTertiary, lineHeight: 1.5, marginBottom: 8 },

  hero: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  heroText: { flex: 1 },
  title: { fontSize: 10, color: C.inkSecondary, marginBottom: 6 },
  figure: { fontSize: 38, fontFamily: 'Courier-Bold', letterSpacing: -1 },
  figureCompact: { fontSize: 30, fontFamily: 'Courier-Bold', letterSpacing: -1 },
  caption: { fontSize: 8.5, color: C.inkSecondary, marginTop: 8 },

  mapCard: { width: MAP_WIDTH },
  map: { width: MAP_WIDTH, height: 104, objectFit: 'cover', borderRadius: 3 },
  mapCaption: { fontSize: 6.5, color: C.inkTertiary, marginTop: 4, lineHeight: 1.3 },

  lossCard: { width: LOSS_CARD_WIDTH, borderWidth: 1, borderColor: C.border, borderRadius: 4, padding: 8 },
  photo: { width: '100%', height: 70, objectFit: 'cover', borderRadius: 3, marginBottom: 6 },
  photoFallback: { height: 70, backgroundColor: C.sunken, borderRadius: 3, marginBottom: 6,
    alignItems: 'center', justifyContent: 'center' },
  lossHeading: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: C.inkSecondary, marginBottom: 4 },
  lossAddress: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  lossMeta: { fontSize: 7.5, color: C.inkSecondary },

  h2: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.inkSecondary,
    borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 4, marginBottom: 5 },
  block: { marginBottom: 10 },
  threeUp: { flexDirection: 'row', gap: 16, marginBottom: 8 },
  col: { flex: 1 },

  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    borderBottomWidth: 1, borderBottomColor: C.border, paddingVertical: 2.5 },
  rowTotal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    borderTopWidth: 1, borderTopColor: C.ink, paddingTop: 4, marginTop: 2 },
  // Labels shrink and wrap; values never do. Without this a long label and a
  // wide figure overprint each other in the narrow comp cards.
  rowLabel: { color: C.inkSecondary, flex: 1, paddingRight: 6 },
  rowTotalLabel: { fontFamily: 'Helvetica-Bold', flex: 1, paddingRight: 6 },
  rowValue: { fontFamily: 'Courier', flexShrink: 0 },
  rowTotalValue: { fontFamily: 'Courier-Bold', flexShrink: 0 },
  footnote: { fontSize: 6.5, color: C.inkTertiary, marginTop: 4, lineHeight: 1.4 },

  compGrid: { flexDirection: 'row', gap: 10 },
  compCard: { flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 4, padding: 7 },
  compIndex: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.inkTertiary, marginBottom: 3 },
  compAddr: { fontSize: 8.5, fontFamily: 'Helvetica-Bold' },
  compSpecs: { fontSize: 7, color: C.inkSecondary, marginTop: 1 },
  compRows: { marginTop: 4, fontSize: 7 },
  link: { color: C.ink, textDecoration: 'none' },

  complianceRow: { flexDirection: 'row', gap: 12 },
  complianceItem: { flex: 1, flexDirection: 'row', gap: 5 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.pass, marginTop: 3 },
  complianceText: { flex: 1, fontSize: 7.5, lineHeight: 1.35 },
  bold: { fontFamily: 'Helvetica-Bold' },

  attribution: { fontSize: 6.5, color: C.inkTertiary, marginTop: 5 },
  footer: { marginTop: 'auto', borderTopWidth: 1, borderTopColor: C.border, paddingTop: 6 },
  neutrality: { fontSize: 7, color: C.inkSecondary, lineHeight: 1.4,
    backgroundColor: C.sunken, padding: 6, borderRadius: 3 },
});

// react-pdf reads files from disk, not from the web root, and renders PNG/JPEG
// only — a "/brand/…" path or an SVG fails silently and leaves a blank box.
// The files are traced into the Vercel function via next.config.mjs.
const publicFile = (rel: string) => path.join(process.cwd(), 'public', rel);

function LogoImage() {
  return <Image src={publicFile('brand/nova-havens-logo.png')} style={{ width: 20, height: 20 }} />;
}

function HouseImage() {
  return <Image src={publicFile('images/generic-house.png')} style={{ width: 70, height: 70 }} />;
}

function Rows({ rows, emphasiseLast = true }: { rows: Array<{ label: string; value: string }>; emphasiseLast?: boolean }) {
  const last = rows.length - 1;
  return (
    <View>
      {rows.map((r, i) => {
        const total = emphasiseLast && i === last;
        return (
          <View key={r.label} style={total ? s.rowTotal : s.row}>
            <Text style={total ? s.rowTotalLabel : s.rowLabel}>{r.label}</Text>
            <Text style={total ? s.rowTotalValue : s.rowValue}>{r.value}</Text>
          </View>
        );
      })}
    </View>
  );
}

export function ReportDocument({
  model,
  images,
}: {
  model: ReportModel;
  images?: { photo?: Buffer; map?: Buffer };
}) {
  const hasMap = Boolean(images?.map);
  return (
    <Document title={`Fair Rental Value — ${model.claimIdentifier}`} author="Nova Havens">
      <Page size="A4" style={s.page}>
        <View style={s.masthead}>
          <View style={s.brand}>
            <LogoImage />
            <Text style={s.brandName}>Nova Havens Fair Rental Value</Text>
          </View>
          <View style={s.meta}>
            <View>
              <Text style={s.metaLabel}>Claim</Text>
              <Text style={s.metaValue}>{model.claimIdentifier}</Text>
            </View>
            <View>
              <Text style={s.metaLabel}>Prepared</Text>
              <Text style={s.metaValue}>{model.preparedOn}</Text>
            </View>
            <View>
              <Text style={s.metaLabel}>Status</Text>
              <Text style={s.metaValue}>
                {model.status}{model.version > 1 ? ` · v${model.version}` : ''}
              </Text>
            </View>
          </View>
        </View>

        <Text style={s.preamble}>
          {model.notes.evaluation} {model.notes.availability}
        </Text>

        <View style={s.hero}>
          <View style={s.heroText}>
            <Text style={s.title}>Fair Rental Value</Text>
            {/* The map borrows width from the figure, so the figure steps down a size. */}
            <Text style={hasMap ? s.figureCompact : s.figure}>{model.headline.amount}</Text>
            <Text style={s.caption}>{model.headline.caption}</Text>
          </View>
          {images?.map && (
            <View style={s.mapCard}>
              <Image src={{ data: images.map, format: 'png' }} style={s.map} />
              <Text style={s.mapCaption}>
                {model.map?.caption ?? 'Loss address (L) and comparables 1–3.'}
              </Text>
            </View>
          )}
          <View style={s.lossCard}>
            {images?.photo ? (
              <Image src={{ data: images.photo, format: 'jpg' }} style={s.photo} />
            ) : (
              <View style={s.photoFallback}><HouseImage /></View>
            )}
            <Text style={s.lossHeading}>Loss Address Details</Text>
            <Text style={s.lossAddress}>{model.loss.address}</Text>
            <Text style={s.lossMeta}>{model.loss.size}</Text>
            <Text style={s.lossMeta}>Square footage: {model.loss.squareFootage}</Text>
            <Text style={s.lossMeta}>Minimum lease term: {model.loss.minimumLeaseTerm}</Text>
          </View>
        </View>

        <View style={s.block}>
          <Text style={s.h2}>FRV Address Details — averaged across three comparables</Text>
          <Rows rows={model.averaged} />
        </View>

        <View style={s.block}>
          <Text style={s.h2}>Comparables used</Text>
          <View style={s.compGrid}>
            {model.comps.map((comp) => (
              <View key={comp.position} style={s.compCard}>
                <Text style={s.compIndex}>Comparable {comp.position}</Text>
                <Link src={comp.url} style={s.link}>
                  <Text style={s.compAddr}>{comp.address}</Text>
                </Link>
                <Text style={s.compSpecs}>{comp.propertyType}</Text>
                <Text style={s.compSpecs}>{comp.size}</Text>
                <Text style={s.compSpecs}>Square footage: {comp.squareFootage}</Text>
                <Text style={s.compSpecs}>Distance: {comp.distance}</Text>
                <View style={s.compRows}>
                  <Rows rows={comp.rows} />
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={s.threeUp}>
          <View style={s.col}>
            <Text style={s.h2}>12-month FRV Details</Text>
            <Rows rows={model.twelveMonth} />
            <Text style={s.footnote}>
              A standard long-term unfurnished placement. No short-term multiplier and no furniture.
            </Text>
          </View>
          <View style={s.col}>
            <Text style={s.h2}>Furniture and housewares pricing guideline</Text>
            <Rows rows={model.furnitureTable} emphasiseLast={false} />
            <Text style={s.footnote}>{model.notes.furnitureDisclaimer}</Text>
          </View>
          <View style={s.col}>
            <Text style={s.h2}>Short-term rental multipliers applied to base rent</Text>
            <Rows rows={model.multiplierTable} emphasiseLast={false} />
          </View>
        </View>

        <View>
          <Text style={s.h2}>Compliance</Text>
          <View style={s.complianceRow}>
            {model.compliance.map((item) => (
              <View key={item.label} style={s.complianceItem}>
                <View style={s.dot} />
                <Text style={s.complianceText}>
                  <Text style={s.bold}>{item.label}.</Text> {item.detail}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={s.footer} wrap={false}>
          <Text style={s.neutrality}>{model.notes.neutrality}</Text>
          {model.notes.attribution && <Text style={s.attribution}>{model.notes.attribution}</Text>}
        </View>
      </Page>
    </Document>
  );
}
