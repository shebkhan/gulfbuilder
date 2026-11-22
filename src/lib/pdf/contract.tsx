import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { formatMoney } from "@/lib/money";

export type ContractPdfData = {
  orgName: string;
  leaseNo: string;
  tenant: string;
  unit: string;
  startDate: string;
  endDate: string;
  frequency: string;
  installments: number;
  dueDay: number;
  noticeDays: number;
  registrationNo: string | null;
  rent: number;
  deposit: number;
  currency: string;
  terms: { effectiveFrom: string; rent: number; note: string | null }[];
  footer: string;
};

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: "Helvetica" },
  title: { fontSize: 18, marginBottom: 12, fontWeight: "bold" },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  label: { color: "#555" },
  section: { marginTop: 12, marginBottom: 4, fontWeight: "bold" },
  total: { marginTop: 8, fontSize: 12, fontWeight: "bold" },
  footer: { marginTop: 24, fontSize: 9, color: "#888" },
});

export function ContractPdf({ data }: { data: ContractPdfData }) {
  const money = (n: number) => formatMoney(BigInt(n), data.currency, "en");
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{data.orgName}</Text>
        <Text style={{ marginBottom: 12 }}>Lease contract {data.leaseNo}</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Tenant</Text>
          <Text>{data.tenant}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Unit</Text>
          <Text>{data.unit}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Start date</Text>
          <Text>{data.startDate}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>End date</Text>
          <Text>{data.endDate}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Payment frequency</Text>
          <Text>{data.frequency}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Installments</Text>
          <Text>{data.installments}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Due day</Text>
          <Text>{data.dueDay}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Notice days</Text>
          <Text>{data.noticeDays}</Text>
        </View>
        {data.registrationNo ? (
          <View style={styles.row}>
            <Text style={styles.label}>Registration no.</Text>
            <Text>{data.registrationNo}</Text>
          </View>
        ) : null}
        <Text style={styles.total}>Rent: {money(data.rent)}</Text>
        <Text style={styles.total}>Deposit: {money(data.deposit)}</Text>
        {data.terms.length > 0 ? (
          <View style={{ marginTop: 12 }}>
            <Text style={styles.section}>Rent terms</Text>
            {data.terms.map((t, i) => (
              <View key={i} style={styles.row}>
                <Text style={styles.label}>{t.effectiveFrom}</Text>
                <Text>{money(t.rent)}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <Text style={styles.footer}>{data.footer}</Text>
      </Page>
    </Document>
  );
}