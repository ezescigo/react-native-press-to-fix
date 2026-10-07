import { useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useFixScreen } from 'react-native-press-to-fix'

import { CategoryChips } from '../components/CategoryChips'
import { DrinkRow } from '../components/DrinkRow'
import { DRINKS, type Category } from '../menu'

export function MenuScreen() {
  useFixScreen('Menu')
  const [category, setCategory] = useState<Category>('All')
  const drinks = category === 'All' ? DRINKS : DRINKS.filter(drink => drink.category === category)

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.greeting}>Good morning</Text>
      <Text style={styles.title}>What are we brewing?</Text>
      <View style={styles.chips}>
        <CategoryChips selected={category} onSelect={setCategory} />
      </View>
      <View style={styles.list}>
        {drinks.map(drink => (
          <DrinkRow key={drink.id} drink={drink} />
        ))}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { paddingVertical: 20 },
  greeting: { fontSize: 15, color: '#8a7565', paddingHorizontal: 20 },
  title: { fontSize: 28, fontWeight: '800', color: '#3b2a20', paddingHorizontal: 20, marginTop: 4 },
  chips: { marginTop: 20, marginHorizontal: -20, paddingLeft: 20 },
  list: { paddingHorizontal: 20, marginTop: 8 },
})
