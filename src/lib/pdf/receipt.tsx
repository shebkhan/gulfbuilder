import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { formatMoney } from "@/lib/money";

export type ReceiptPdfData = {
  orgName: string;
  receiptNo: string;
  tenant: string;
  lease: string | null;
  method: string;
  date: string;
  reference: string | null;
  amount: number;
  currency: string;
  allocations: { label: string; detail?: string; amount: number }[];
  footer: string;
};

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: "Helvetica" },
  title: { fontSize: 18, marginBottom: 12, fontWeight: "bold" },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  label: { color: "#555" },
  total: { marginTop: 12, fontSize: 13, fontWeight: "bold" },
  footer: { marginTop: 24, fontSize: 9, color: "#888" },
});

export function ReceiptPdf({ data }: { data: ReceiptPdfData }) {
  const money = (n: number) => formatMoney(BigInt(n), data.currency, "en");
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{data.orgName}</Text>
        <Text style={{ marginBottom: 12 }}>Receipt {data.receiptNo}</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Tenant</Text>
          <Text>{data.tenant}</Text>
        </View>
        {data.lease ? (
          <View style={styles.row}>
            <Text style={styles.label}>Lease</Text>
            <Text>{data.lease}</Text>
          </View>
        ) : null}
        <View style={styles.row}>
          <Text style={styles.label}>Method</Text>
          <Text>{data.method}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Date</Text>
          <Text>{data.date}</Text>
        </View>
        {data.reference ? (
          <View style={styles.row}>
            <Text style={styles.label}>Reference</Text>
            <Text>{data.reference}</Text>
          </View>
        ) : null}
        {data.allocations.map((a, i) => (
          <View key={i} style={styles.row}>
            <Text style={styles.label}>
              {a.label}
              {a.detail ? ` (${a.detail})` : ""}
            </Text>
            <Text>{money(a.amount)}</Text>
          </View>
        ))}
        <Text style={styles.total}>Total: {money(data.amount)}</Text>
        <Text style={styles.footer}>{data.footer}</Text>
      </Page>
    </Document>
  );
}