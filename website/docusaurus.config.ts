import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const GITHUB = 'https://github.com/MateenKhan/table';
const NPM = 'https://www.npmjs.com/package/@jugaaadi/table';

/** The landing page + interactive demo is the Vite app at root (/). */
const DEMO = 'https://table.jugaaadi.com/';

const config: Config = {
  title: '@jugaaadi/table',
  tagline:
    'A spreadsheet-style data table for React with editable cells, formulas, rich column types, and a query builder.',
  favicon: '/favicon.svg',

  future: { v4: true },

  url: 'https://table.jugaaadi.com',
  baseUrl: '/docs/',

  organizationName: 'MateenKhan',
  projectName: 'table',

  trailingSlash: true,
  onBrokenLinks: 'throw',

  i18n: { defaultLocale: 'en', locales: ['en'] },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: '/',
          editUrl: `${GITHUB}/tree/main/website/`,
        },
        blog: false,
        theme: { customCss: './src/css/custom.css' },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    colorMode: { respectPrefersColorScheme: true },
    navbar: {
      title: '@jugaaadi/table',
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Docs',
        },
        { to: '/query', label: 'Query', position: 'left' },
        { to: '/theming', label: 'Theming', position: 'left' },
        { href: DEMO, label: 'Live demo', position: 'left' },
        { href: NPM, label: 'npm', position: 'right' },
        { href: GITHUB, label: 'GitHub', position: 'right' },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            { label: 'Getting started', to: '/intro' },
            { label: 'Integrating', to: '/integrating' },
            { label: 'Query builder', to: '/query' },
            { label: 'Theming', to: '/theming' },
          ],
        },
        {
          title: 'Project',
          items: [
            { label: 'Live demo', href: DEMO },
            { label: 'npm', href: NPM },
            { label: 'GitHub', href: GITHUB },
            { label: 'Issues', href: `${GITHUB}/issues` },
          ],
        },
        {
          title: 'Built on',
          items: [
            { label: 'TanStack Table', href: 'https://tanstack.com/table' },
          ],
        },
      ],
      copyright: `MIT © ${new Date().getFullYear()} jugaaadi. Provided as is, without warranty — verify your own numbers.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
