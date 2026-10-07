import { StatusBar } from 'expo-status-bar'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { FixHost } from 'react-native-press-to-fix'

import { ActivityScreen } from './src/screens/ActivityScreen'
import { CardsScreen } from './src/screens/CardsScreen'
import { HomeScreen } from './src/screens/HomeScreen'

const TABS = { Home: HomeScreen, Cards: CardsScreen, Activity: ActivityScreen }
type Tab = keyof typeof TABS

export default function App() {
  const [tab, setTab] = useState<Tab>('Home')
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
                <Text style={[styles.tabLabel, name === tab && styles.selected]}>{name}</Text>
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
  container: { flex: 1, backgroundColor: '#fff' },
  screen: { flex: 1 },
  tabs: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#d1d5db' },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  tabLabel: { fontSize: 14, color: '#6b7280' },
  selected: { color: '#1f3a5f', fontWeight: '700' },
})
