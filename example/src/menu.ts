export type Category = 'All' | 'Hot' | 'Iced' | 'Tea'

export type Drink = { id: string; name: string; notes: string; price: number; category: Exclude<Category, 'All'> }

export const CATEGORIES: Category[] = ['All', 'Hot', 'Iced', 'Tea']

export const DRINKS: Drink[] = [
  { id: 'flat-white', name: 'Flat White', notes: 'Double ristretto, steamed milk', price: 4.5, category: 'Hot' },
  { id: 'cortado', name: 'Cortado', notes: 'Equal parts espresso and milk', price: 3.75, category: 'Hot' },
  { id: 'cold-brew', name: 'Cold Brew', notes: '18-hour steep, served over ice', price: 5, category: 'Iced' },
  { id: 'iced-latte', name: 'Iced Oat Latte', notes: 'Espresso, oat milk, ice', price: 5.25, category: 'Iced' },
  { id: 'chai', name: 'Masala Chai', notes: 'Black tea, cardamom, ginger', price: 4.2, category: 'Tea' },
]

export const ORDER = [
  { drink: DRINKS[0], quantity: 2 },
  { drink: DRINKS[2], quantity: 1 },
]

export const STAMPS = 7
export const STAMPS_FOR_FREE_DRINK = 8

export const formatPrice = (price: number) => `$${price}`
