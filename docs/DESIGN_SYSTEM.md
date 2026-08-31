# Asternal — Design System

> **Guía visual y funcional** para mantener la coherencia del proyecto en cada nueva implementación.
> Última actualización: Agosto 2026.

---

## 1. Paleta de colores

### Tema principal: Soft Blue (oklch)

La paleta se define en `src/index.css` usando oklch para un control preciso de luminosidad, croma y matiz. Todos los colores derivan del mismo matiz (hue 250 — azul suave).

#### Modo claro

| Token | Valor | Uso |
|---|---|---|
| `--background` | `oklch(0.988 0.004 250)` | Fondo general de la app |
| `--foreground` | `oklch(0.20 0.01 250)` | Texto principal |
| `--card` | `oklch(0.995 0.003 250)` | Fondo de tarjetas (posts, compositor) |
| `--primary` | `oklch(0.52 0.10 250)` | Color principal — botones, acentos, enlaces |
| `--primary-foreground` | `oklch(0.99 0.003 250)` | Texto sobre fondos primary |
| `--muted` | `oklch(0.96 0.005 250)` | Fondos secundarios, pills inactivos |
| `--muted-foreground` | `oklch(0.48 0.01 250)` | Texto secundario, timestamps |
| `--accent` | `oklch(0.95 0.015 250)` | Fondos de hover sutil |
| `--destructive` | `oklch(0.58 0.18 25)` | Eliminar, errores, confirmaciones peligrosas |
| `--border` | `oklch(0.915 0.006 250)` | Bordes de tarjetas, separadores |

#### Modo oscuro

| Token | Valor | Uso |
|---|---|---|
| `--background` | `oklch(0.14 0.008 250)` | Fondo general |
| `--primary` | `oklch(0.62 0.12 250)` | Azul más luminoso para contraste |
| `--destructive` | `oklch(0.62 0.18 25)` | Rojo más brillante en oscuridad |

### Reglas de color

- **Sin degradados**: todos los colores son sólidos y puros.
- **Sin colores hardcodeados**: usar siempre tokens semánticos (`text-primary`, `bg-card`, `text-muted-foreground`, etc.).
- **Selección de texto**: `::selection` usa `primary/25%` para mantener legibilidad.
- **Modo oscuro**: disponible via clase `.dark` en el body.

---

## 2. Sistema de botones

### Jerarquía visual

La jerarquía de botones sigue un principio de **contraste decreciente** según la importancia de la acción:

| Nivel | Ejemplo | Estilo | Cuándo usar |
|---|---|---|---|
| **Primario** | Publicar | `bg-primary text-primary-foreground` + padding amplio | Acción principal de la pantalla |
| **Secundario** | Me gusta (activo), Favorito (activo) | Pill con fondo `bg-primary/10` o `bg-yellow-500/10` | Interacciones recurrentes, estados activos |
| **Terciario** | Compartir, Ver comentarios | Ghost con texto muted, pill neutro | Acciones complementarias |
| **Outline** | Seguir | `border border-primary/30 text-primary` | Acciones de.follow/infollow |
| **Destructive** | Eliminar (hover), Confirmar eliminación | `hover:bg-destructive/5 hover:text-destructive` o `variant="destructive"` | Acciones irreversibles |
| **Fantasma** | Formato de texto, Cerrar sesión | `variant="ghost"` | Utilitarios, herramientas |

### Tamaños de botón

| Clase | Tamaño | Uso |
|---|---|---|
| `size="lg"` | Grande | CTAs de landing page |
| `size="default"` | Medio | Publicar, diálogos |
| `size="sm"` | Pequeño | Acciones secundarias, herramientas |
| `text-[11px] px-2.5 py-0.5` | Extra-pequeño | Botón Seguir inline |
| `text-xs px-3 py-1.5 rounded-lg` | Pill | Interacciones de posts (like, fav, share) |

### Estados de interacción

- **Hover**: transición suave de color (`transition-colors`)
- **Tap**: escala reducida (`whileTap={{ scale: 0.85-0.92 }}`)
- **Loading**: spinner de borde (`animate-spin rounded-full border-2 border-current border-t-transparent`)
- **Deshabilitado**: `disabled` nativo del HTML, estilo apagado

---

## 3. Distribución de la interfaz

### Estructura general

```
┌─────────────────────────────┐
│  Nav (sticky top-0)         │  Logo + nombre + usuario + cerrar sesión
├─────────────────────────────┤
│  Tabs (sticky top-14)       │  Para ti | Seguidos | Populares
├─────────────────────────────┤
│  Main (max-w-2xl mx-auto)   │
│  ├─ Compositor              │  Título + editor + media + docs + toolbar
│  ├─ Feed                    │  Posts con AnimatePresence
│  │  ├─ PostCard × N         │  Autor + contenido + media + docs + acciones
│  │  └─ Empty state          │  Mensaje contextual por pestaña
├─────────────────────────────┤
│  Overlays                   │
│  ├─ Lightbox                │  Pantalla completa para media
│  ├─ CommentsModal           │  Comentarios en pantalla completa
│  ├─ MentionPicker           │  Selector de menciones
│  └─ Dialogs                 │  Confirmación delete/unfollow
└─────────────────────────────┘
```

### Layout responsivo

- **Contenedor principal**: `max-w-2xl mx-auto px-4` — centrado, ancho máximo 672px
- **Nav**: `h-14` (56px), sticky
- **Tabs**: `sticky top-14`, debajo del nav
- **Padding mobile**: `px-4 py-6` → `sm:px-5 sm:py-10`
- **Gap entre posts**: `gap-4 sm:gap-5`
- **Cards**: `rounded-2xl border border-border/60 bg-card`
- **Separadores**: `border-border/40` o `border-border/50`

### Espaciado estándar

| Elemento | Espaciado |
|---|---|
| Dentro de cards | `p-4 sm:p-5` |
| Entre avatar y contenido | `gap-3 sm:gap-3.5` |
| Entre acciones | `gap-2 sm:gap-3` |
| Entre posts | `gap-4 sm:gap-5` |
| Separadores horizontales | `border-t border-border/40` |

---

## 4. Animaciones

### Motor

**Framer Motion** (`framer-motion`) — todas las animaciones de la app usan este library.

### Reglas generales

1. **Nunca combinar CSS `transition` de `transform`/`opacity` con Framer Motion** en el mismo elemento — causa parpadeo en Safari móvil.
2. El CSS global (`*`) solo transiciona: `color, background-color, border-color, box-shadow, fill, stroke`.
3. Para transiciones CSS de `transform`/`opacity`, usar la clase utility `.transition-smooth`.
4. Los elementos `motion.*` deben excluirse de las transiciones CSS globales via `[data-framer-motion]`.

### Animaciones de entrada/salida

| Componente | Entrada | Salida | Duración |
|---|---|---|---|
| **PostCard** | `opacity: 0, y: 16` → `1, 0` | `opacity: 0, scale: 0.97, y: -8` | 0.3s |
| **Composer** | `opacity: 0, y: 12` → `1, 0` | — | 0.35s, delay 0.05s |
| **Tab content** | `opacity: 0` → `1` | `opacity: 0` | 0.15s (cambio rápido) |
| **Empty state** | `opacity: 0, y: 8` → `1, 0` | — | 0.3s |
| **Diálogos** | Overlay fade + content `scale: 0.92, y: 8` → `1, 0` | Reversa | 0.25s |
| **Lightbox** | Overlay fade + content fade | Reversa | 0.2s |
| **Nav** | Estático (sin animación de entrada) | — | — |

### Micro-interacciones

| Elemento | Trigger | Efecto | Spring config |
|---|---|---|---|
| **Tab indicator** | `layoutId="activeTab"` | Deslizamiento horizontal | `stiffness: 600, damping: 40` |
| **Heart (like)** | `whileTap` | `scale: [1, 1.25, 1]` | `duration: 0.2, ease: "easeOut"` |
| **Star (fav)** | `whileTap` | `scale: [1, 1.3, 1]` | `duration: 0.2` |
| **Follow button** | `whileTap` | `scale: 0.92` | Spring implícito |
| **Delete/Share** | `whileTap` | `scale: 0.85-0.9` | Spring implícito |
| **Pending media** | `AnimatePresence` | `scale: 0.9→1, opacity: 0→1` | Default |
| **Mention list** | `AnimatePresence` | `x: -8→0, opacity: 0→1` stagger | Progressivo |

### Scroll-to-top

Al cambiar de pestaña, se ejecuta `window.scrollTo({ top: 0, behavior: "smooth" })` para volver al inicio de forma fluida.

### Exclusiones CSS globales

```css
.animate-spin,
.animate-pulse,
[data-framer-motion],
[data-framer-motion] * {
  transition-duration: unset;
  transition-property: unset;
}
```

---

## 5. Tipografía

| Elemento | Clase | Tamaño |
|---|---|---|
| Nav title | `text-lg font-extrabold tracking-tight` | ~18px |
| Post title | `text-base font-bold leading-snug` | 16px |
| Post content | `text-[15px] leading-relaxed` | 15px |
| Author name | `text-sm font-semibold` | 14px |
| Timestamp | `text-xs text-muted-foreground` | 12px |
| Actions | `text-xs font-medium` | 12px |
| Tab label | `text-sm font-medium` | 14px |
| Empty state title | `text-sm font-medium text-foreground` | 14px |
| Empty state desc | `text-xs text-muted-foreground` | 12px |
| H1 in post | `text-[24px] font-bold` | 24px |
| H2 in post | `text-[20px] font-bold` | 20px |
| H3 in post | `text-[17px] font-bold` | 17px |

---

## 6. Componentes clave

### PostCard
- **Avatar**: `h-10 w-10`, fallback con iniciales en `bg-primary/10 text-primary`
- **Header**: autor + timestamp + botón Seguir (outline)
- **Contenido**: HTML sanitizado con soporte para `#hashtags` (azul) y `@menciones` (primary con fondo)
- **Media**: grid responsivo,.lightbox al click, badge de dimensiones no óptimas
- **Documentos**: botón blanco organizado con icono, nombre, tamaño, extensión
- **Acciones**: pills con fondo sutil (like: primary/10, fav: yellow/10, share: neutro)
- **Comentarios**: botón completo en la parte inferior

### Diálogos de confirmación
- Overlay: `bg-black/50` con fade
- Contenido: `rounded-2xl border border-border/60 bg-card p-6`
- Icono: círculo con fondo `bg-destructive/10` + `AlertTriangle`
- Botones: outline (cancelar) + destructive (confirmar)

---

## 7. Checklist al añadir nueva funcionalidad

- [ ] Usar tokens de color semánticos (no hardcodear colores)
- [ ] Respetar la jerarquía de botones
- [ ] Añadir animaciones Framer Motion (no CSS transition de transform/opacity)
- [ ] Usar `AnimatePresence` para elementos que entran/salen
- [ ] Mantener responsive (usar `sm:` breakpoint)
- [ ] Verificar mobile Safari (no backdrop-blur + motion en el mismo elemento)
- [ ] Verificar que compila: `bun tsc -b --noEmit`
- [ ] Mantener la paleta azul (hue 250) coherente
