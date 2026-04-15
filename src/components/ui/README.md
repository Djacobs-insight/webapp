# Design System Foundations

## Theme Tokens (globals.css)
- Coral (Primary): `#E8654A`
- Teal (Secondary): `#2BA5A5`
- Warm White (Background): `#FDF8F4`
- Gold (Accent): `#F5A623`
- Lavender (Accent): `#8B7EC8`
- Charcoal (Text): `#2D2D2D`
- Font: 'JetBrains Mono', monospace

## Button Hierarchy
- Primary: coral, 56px, rounded-full
- Secondary: outline teal, 48px
- Ghost: teal text, 44px
- Destructive: outline red, confirm/undo
- Icon-only: 48px circle

## Typography Scale
- Display: 28px/700
- H1: 24px/700
- H2: 20px/600
- Body: 16px/400
- Caption: 12px/500
- Number Display: 32px/800

## Spacing System
- 4px base unit: xs=4, sm=8, md=12, lg=16, xl=24, 2xl=32
- Card padding: 16px
- Screen edge: 16px/24px

## Empty State Pattern
- Use `<EmptyState />` component for all empty views
- Icon, title, description, and optional action

## shadcn/ui
- Copy base components into `src/components/ui/` as needed

---
