# CodeDesign Marketplace - UI Specification

## Design System

### Color Palette

- **Primary Color**: `#0066FF` (Blue)
- **Primary Dark**: `#0052CC`
- **Secondary Color**: `#6B7280` (Gray)
- **Success Color**: `#10B981` (Green)
- **Danger Color**: `#EF4444` (Red)
- **Background White**: `#FFFFFF`
- **Background Gray**: `#F9FAFB`
- **Text Primary**: `#111827`
- **Text Secondary**: `#6B7280`
- **Border Color**: `#E5E7EB`

### Typography

- **Font Family**: Inter (Google Fonts)
- **Font Weights**: 300, 400, 500, 600, 700
- **Base Font Size**: 16px
- **Headings**:
  - H1: 3rem (48px) - Hero titles
  - H2: 2rem (32px) - Section titles
  - H3: 1.5rem (24px) - Card titles
  - H4: 1.25rem (20px) - Subsection titles

### Spacing

- **Base Unit**: 0.25rem (4px)
- **Common Spacing**:
  - xs: 0.5rem (8px)
  - sm: 1rem (16px)
  - md: 1.5rem (24px)
  - lg: 2rem (32px)
  - xl: 3rem (48px)

### Border Radius

- **Small**: 0.375rem (6px)
- **Medium**: 0.5rem (8px)
- **Large**: 0.75rem (12px)
- **XL**: 1rem (16px)
- **2XL**: 1.5rem (24px) - Used for cards

### Shadows

- **Small**: `0 1px 2px 0 rgba(0, 0, 0, 0.05)`
- **Medium**: `0 4px 6px -1px rgba(0, 0, 0, 0.1)`
- **Large**: `0 10px 15px -3px rgba(0, 0, 0, 0.1)`

## Components

### Freelancer Card

**Dimensions**:
- Width: 280px (min) - responsive grid
- Padding: 1.5rem
- Border Radius: 1.5rem (2xl)

**Structure**:
```
┌─────────────────────────┐
│ [Avatar]  Name           │
│          ⭐ 4.8 (25)     │
│                          │
│ [Python] [React] [Node]  │
│                          │
│ Starting at $500         │
│                          │
│ [View Profile] [Hire]    │
└─────────────────────────┘
```

**Hover Effect**:
- Transform: translateY(-4px)
- Shadow: Large
- Border color: Primary blue

### Package Card

**Dimensions**:
- Width: 100% (within sidebar)
- Padding: 1.5rem
- Border: 2px solid border-color

**Structure**:
```
┌─────────────────────────┐
│ Package Name             │
│ Description text...      │
│                          │
│ $1,500                   │
│                          │
│ ✓ Deliverable 1          │
│ ✓ Deliverable 2          │
│                          │
│ [Buy Now Button]         │
└─────────────────────────┘
```

### Search Bar

**Dimensions**:
- Height: 3rem
- Border Radius: 1.5rem (2xl)
- Padding: 1rem 1.5rem

**Layout**:
- Input: flex-1
- Button: Fixed width with icon

### Button Styles

**Primary Button**:
- Background: Primary blue (#0066FF)
- Color: White
- Padding: 0.625rem 1.25rem
- Border Radius: 0.75rem
- Hover: Darker blue, slight lift

**Secondary Button**:
- Background: Light gray
- Color: Text primary
- Same padding and radius

## Layout Patterns

### Header

- Height: Auto (sticky)
- Background: White
- Border: Bottom 1px solid border-color
- Shadow: Small
- Padding: 1rem 0

**Logo**:
- Font size: 1.5rem
- Font weight: 700
- Color: Primary blue
- Icon: Font Awesome code icon

**Navigation**:
- Gap: 2rem
- Links: Secondary color, hover to primary

### Hero Section

- Background: Gradient (purple to blue)
- Color: White
- Padding: 4rem 0
- Text align: Center

**Search Bar**:
- Max width: 600px
- Centered
- White background with shadow

### Grid Layouts

**Freelancer Grid**:
- Grid: `repeat(auto-fill, minmax(280px, 1fr))`
- Gap: 2rem
- Responsive: Single column on mobile

**Portfolio Grid**:
- Grid: `repeat(auto-fill, minmax(200px, 1fr))`
- Gap: 1rem

## Icons

**Icon Library**: Font Awesome 6.4.0 (via CDN)

**Common Icons**:
- Code: `fas fa-code`
- User: `fas fa-user`
- Search: `fas fa-search`
- Star: `fas fa-star`
- Check: `fas fa-check`
- Paper Plane: `fas fa-paper-plane`
- Sign In: `fas fa-sign-in-alt`
- User Plus: `fas fa-user-plus`

## Responsive Breakpoints

- **Mobile**: < 768px
  - Single column layouts
  - Reduced font sizes
  - Stacked navigation

- **Tablet**: 768px - 1024px
  - 2-column grids
  - Adjusted spacing

- **Desktop**: > 1024px
  - Full grid layouts
  - Maximum container width: 1200px

## Animation

**Transitions**:
- Duration: 0.2s - 0.3s
- Easing: Default (ease)

**Hover Effects**:
- Cards: Lift with shadow increase
- Buttons: Slight lift, color change
- Links: Color transition

## Sample HTML Snippets

### Freelancer Card
```html
<div class="freelancer-card">
    <div class="freelancer-card-header">
        <div class="freelancer-avatar">
            <i class="fas fa-user"></i>
        </div>
        <div class="freelancer-info">
            <h3>John Developer</h3>
            <div class="rating">
                <i class="fas fa-star"></i>
                <span>4.8 (25)</span>
            </div>
        </div>
    </div>
    <div class="freelancer-skills">
        <span class="skill-tag">Python</span>
        <span class="skill-tag">React</span>
    </div>
    <div class="freelancer-price">Starting at $500</div>
    <div class="freelancer-card-actions">
        <button class="btn btn-primary btn-small">View Profile</button>
        <button class="btn btn-secondary btn-small">Hire</button>
    </div>
</div>
```

### Package Card
```html
<div style="background: white; border-radius: 1.5rem; padding: 1.5rem; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
    <h3>Premium Package</h3>
    <p>Premium package with support</p>
    <div style="font-size: 2rem; font-weight: 700; color: #0066FF;">$1,500</div>
    <ul>
        <li><i class="fas fa-check"></i> Deliverable 1</li>
        <li><i class="fas fa-check"></i> Deliverable 2</li>
    </ul>
    <button class="btn btn-primary" style="width: 100%;">Buy Now</button>
</div>
```

## Accessibility

- Semantic HTML elements
- Alt text for images (to be added)
- ARIA labels (to be enhanced)
- Keyboard navigation support (basic)

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

