import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { formatMoney } from "@/lib/money";

export type OwnerStatementPdfData = {
  orgName: string;
  periodStart: string;
  periodEnd: string;
  currency: string;
  status: string;
  opening: number;
  collections: number;
  expenses: number;
  managementFee: number;
  netPayable: number;
  closing: number;
  lines: { kind: string; description: string; amount: number }[];
};

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: "Helvetica" },
  title: { fontSize: 16, marginBottom: 8, fontWeight: "bold" },
  subtitle: { fontSize: 11, marginBottom: 12, color: "#555" },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  label: { color: "#555" },
  total: { marginTop: 12, fontSize: 12, fontWeight: "bold" },
  tableHeader: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#ccc", paddingBottom: 4, marginBottom: 4, fontWeight: "bold" },
  tableRow: { flexDirection: "row", marginBottom: 2 },
  col1: { flex: 2 },
  col2: { flex: 4 },
  col3: { flex: 2, textAlign: "right" },
});

export function OwnerStatementPdf({ data }: { data: OwnerStatementPdfData }) {
  const money = (n: number) => formatMoney(BigInt(n), data.currency, "en");
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{data.orgName}</Text>
        <Text style={styles.subtitle}>
          Owner statement · {data.periodStart} → {data.periodEnd} · {data.status}
        </Text>
        <View style={styles.row}>
          <Text style={styles.label}>Opening</Text>
          <Text>{money(data.opening)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Collections</Text>
          <Text>{money(data.collections)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Expenses</Text>
          <Text>{money(data.expenses)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Management fee</Text>
          <Text>{money(data.managementFee)}</Text>
        </View>
        <Text style={styles.total}>Net payable: {money(data.netPayable)}</Text>
        <Text style={styles.total}>Closing: {money(data.closing)}</Text>

        {data.lines.length > 0 ? (
          <View style={{ marginTop: 16 }}>
            <View style={styles.tableHeader}>
              <Text style={styles.col1}>Kind</Text>
              <Text style={styles.col2}>Description</Text>
              <Text style={styles.col3}>Amount</Text>
            </View>
            {data.lines.map((l, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={styles.col1}>{l.kind}</Text>
                <Text style={styles.col2}>{l.description}</Text>
                <Text style={styles.col3}>{money(l.amount)}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </Page>
    </Document>
  );
}