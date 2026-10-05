import { Document, Page, StyleSheet, Text, View, Link, Image } from '@react-pdf/renderer';
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
 */
const C = {
  ink: '#0a0a0a',
  inkSecondary: '#525252',
  inkTertiary: '#707070',
  border: '#ebebeb',
  sunken: '#fafafa',
  pass: '#05803b',
} as const;

const s = StyleSheet.create({
  page: { paddingVertical: 40, paddingHorizontal: 44, fontSize: 9, color: C.ink, fontFamily: 'Helvetica' },

  masthead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    borderBottomWidth: 1, borderBottomColor: C.ink, paddingBottom: 10, marginBottom: 20 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  brandName: { fontSize: 11, fontFamily: 'Helvetica-Bold' },
  meta: { flexDirection: 'row', gap: 20 },
  metaLabel: { fontSize: 7, color: C.inkTertiary, marginBottom: 2 },
  metaValue: { fontSize: 9, fontFamily: 'Helvetica-Bold' },

  hero: { flexDirection: 'row', gap: 24, marginBottom: 22 },
  heroText: { flex: 1 },
  title: { fontSize: 10, color: C.inkSecondary, marginBottom: 6 },
  figure: { fontSize: 42, fontFamily: 'Courier-Bold', letterSpacing: -1 },
  caption: { fontSize: 9, color: C.inkSecondary, marginTop: 8 },

  lossCard: { width: 168, borderWidth: 1, borderColor: C.border, borderRadius: 4, padding: 8 },
  photoFallback: { height: 74, backgroundColor: C.sunken, borderRadius: 3, marginBottom: 6,
    alignItems: 'center', justifyContent: 'center' },
  lossAddress: { fontSize: 9, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  lossMeta: { fontSize: 8, color: C.inkSecondary },

  h2: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.inkSecondary,
    borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 5, marginBottom: 7 },
  block: { marginBottom: 18 },
  twoUp: { flexDirection: 'row', gap: 24, marginBottom: 18 },
  col: { flex: 1 },

  compAddr: { fontSize: 9, fontFamily: 'Helvetica-Bold' },
  compSpecs: { fontSize: 7.5, color: C.inkSecondary, marginTop: 1 },
  link: { color: C.ink, textDecoration: 'none' },

  row: { flexDirection: 'row', justifyContent: 'space-between',
    borderBottomWidth: 1, borderBottomColor: C.border, paddingVertical: 4 },
  rowTotal: { flexDirection: 'row', justifyContent: 'space-between',
    borderTopWidth: 1, borderTopColor: C.ink, paddingTop: 6, marginTop: 2 },
  rowLabel: { color: C.inkSecondary },
  rowTotalLabel: { fontFamily: 'Helvetica-Bold' },
  rowValue: { fontFamily: 'Courier' },
  rowTotalValue: { fontFamily: 'Courier-Bold' },
  footnote: { fontSize: 7, color: C.inkTertiary, marginTop: 5, lineHeight: 1.4 },

  complianceItem: { flexDirection: 'row', gap: 6, paddingVertical: 3 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.pass, marginTop: 3.5 },
  complianceText: { flex: 1, fontSize: 8.5 },
  bold: { fontFamily: 'Helvetica-Bold' },

  preamble: { fontSize: 7, color: C.inkTertiary, lineHeight: 1.5, marginBottom: 14 },
  lossHeading: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: C.inkSecondary, marginBottom: 5 },
  compGrid: { flexDirection: 'row', gap: 10 },
  compCard: { flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 4, padding: 7 },
  compIndex: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.inkTertiary, marginBottom: 3 },
  compRows: { marginTop: 5 },

  attribution: { fontSize: 6.5, color: C.inkTertiary, marginTop: 6 },
  footer: { marginTop: 'auto', borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10 },
  neutrality: { fontSize: 7, color: C.inkSecondary, lineHeight: 1.5,
    backgroundColor: C.sunken, padding: 8, borderRadius: 3 },
});

function LogoImage() {
  return <Image src="/brand/nova-havens-logo.png" style={{ width: 20, height: 20 }} />;
}

function Rows({ rows }: { rows: Array<{ label: string; value: string }> }) {
  const last = rows.length - 1;
  return (
    <View>
      {rows.map((r, i) => (
        <View key={r.label} style={i === last ? s.rowTotal : s.row}>
          <Text style={i === last ? s.rowTotalLabel : s.rowLabel}>{r.label}</Text>
          <Text style={i === last ? s.rowTotalValue : s.rowValue}>{r.value}</Text>
        </View>
      ))}
    </View>
  );
}

export function ReportDocument({ model }: { model: ReportModel }) {
  return (
    <Document title={`Fair Rental Value — ${model.claimIdentifier}`} author="Nova Havens">
      {/* Single page by requirement. Multi-page output is out of scope. */}
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
            <Text style={s.figure}>{model.headline.amount}</Text>
            <Text style={s.caption}>{model.headline.caption}</Text>
          </View>
          <View style={s.lossCard}>
            <View style={s.photoFallback}><LogoImage /></View>
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
                  {comp.rows.map((r, i) => (
                    <View key={r.label} style={i === comp.rows.length - 1 ? s.rowTotal : s.row}>
                      <Text style={i === comp.rows.length - 1 ? s.rowTotalLabel : s.rowLabel}>
                        {r.label}
                      </Text>
                      <Text style={i === comp.rows.length - 1 ? s.rowTotalValue : s.rowValue}>
                        {r.value}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={s.twoUp}>
          <View style={s.col}>
            <Text style={s.h2}>12-month FRV Details</Text>
            <Rows rows={model.twelveMonth} />
            <Text style={s.footnote}>
              A standard long-term unfurnished placement. No short-term multiplier and no furniture.
            </Text>
          </View>
          <View style={s.col}>
            <Text style={s.h2}>Compliance</Text>
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

        <View style={s.twoUp}>
          <View style={s.col}>
            <Text style={s.h2}>Furniture and housewares pricing guideline</Text>
            {model.furnitureTable.map((r) => (
              <View key={r.label} style={s.row}>
                <Text style={s.rowLabel}>{r.label}</Text>
                <Text style={s.rowValue}>{r.value}</Text>
              </View>
            ))}
            <Text style={s.footnote}>{model.notes.furnitureDisclaimer}</Text>
          </View>
          <View style={s.col}>
            <Text style={s.h2}>Short-term rental multipliers applied to base rent</Text>
            {model.multiplierTable.map((r) => (
              <View key={r.label} style={s.row}>
                <Text style={s.rowLabel}>{r.label}</Text>
                <Text style={s.rowValue}>{r.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={s.footer}>
          <Text style={s.neutrality}>{model.notes.neutrality}</Text>
          {model.notes.attribution && <Text style={s.attribution}>{model.notes.attribution}</Text>}
        </View>
      </Page>
    </Document>
  );
}
