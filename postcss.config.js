export default {
  plugins: {
    // Tailwind CSS v4 moved its PostCSS plugin to a dedicated package.
    // Vendor prefixing is handled internally, so autoprefixer is no longer needed.
    '@tailwindcss/postcss': {},
  },
}
