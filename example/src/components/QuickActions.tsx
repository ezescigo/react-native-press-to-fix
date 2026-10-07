import { Pressable, StyleSheet, Text, View } from 'react-native'

const ACTIONS = ['Send', 'Request', 'Top up']

export function QuickActions() {
  return (
    <View style={styles.row}>
      <Pressable style={[styles.action, styles.send]}>
        <Text style={styles.label}>{ACTIONS[0]}</Text>
      </Pressable>
      <Pressable style={styles.action}>
        <Text style={styles.label}>{ACTIONS[1]}</Text>
      </Pressable>
      <Pressable style={[styles.action, styles.topUp]}>
        <Text style={styles.label}>{ACTIONS[2]}</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  action: { flex: 1, backgroundColor: '#e8eef7', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  send: { marginTop: 10 },
  topUp: { borderRadius: 4 },
  label: { color: '#1f3a5f', fontSize: 15, fontWeight: '600' },
})
