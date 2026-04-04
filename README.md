# anastasiakwei.github.io

Personal website of Anastasia Wei — built with [Astro](https://astro.build), deployed on GitHub Pages.

Live at: [anastasiakwei.github.io](https://anastasiakwei.github.io)

## Stack

- **Framework:** Astro v5
- **Fonts:** Cormorant Garamond, Atkinson Hyperlegible
- **Deployment:** GitHub Actions → GitHub Pages
- **Icons:** astro-icon + Iconify (MDI, Simple Icons)

## Local Development

```sh
npm install
npm run dev       # dev server at localhost:4321
npm run build     # production build to ./dist
npm run preview   # preview production build locally
```

## Project Structure

```
src/
├── components/     # Nav, Footer
├── layouts/        # BaseLayout
├── pages/          # Routes (index, now, writing, projects, favorites, ...)
├── scripts/        # Kandinsky circles animation
├── styles/         # Global CSS
└── content/        # Writing content
```
