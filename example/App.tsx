import { StatusBar } from 'expo-status-bar'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { FixHost } from 'react-native-press-to-fix'

import { MenuScreen } from './src/screens/MenuScreen'
import { OrderScreen } from './src/screens/OrderScreen'
import { RewardsScreen } from './src/screens/RewardsScreen'

const TABS = { Menu: MenuScreen, Order: OrderScreen, Rewards: RewardsScreen }
type Tab = keyof typeof TABS

export default function App() {
  const [tab, setTab] = useState<Tab>('Menu')
  const Screen = TABS[tab]

  return (
    <SafeAreaProvider>
      <FixHost>
        <SafeAreaView style={styles.container}>
          <View style={styles.screen}>
            <Screen />
          </View>
          <View style={styles.tabs}>
            {(Object.keys(TABS) as Tab[]).map(name => (
              <Pressable key={name} onPress={() => setTab(name)} style={styles.tab}>
                <Text style={[styles.tabLabel, name === tab && styles.current]}>{name}</Text>
              </Pressable>
            ))}
          </View>
          <StatusBar style="dark" />
        </SafeAreaView>
      </FixHost>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6efe6' },
  screen: { flex: 1 },
  tabs: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#d8c7b5' },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  tabLabel: { fontSize: 14, color: '#8a7565' },
  current: { color: '#c8643b', fontWeight: '700' },
})
