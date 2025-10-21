// Everforest dark theme utility classes

export const theme = {
  // Card/Container styles
  card: 'bg-everforest-bg1 border border-everforest-bg3 rounded-lg shadow-lg',
  cardHover: 'hover:bg-everforest-bg2 hover:border-everforest-bg4',

  // Input styles
  input: 'bg-everforest-bg2 border-everforest-bg4 text-everforest-fg placeholder-everforest-grey0 focus:border-everforest-green focus:ring-everforest-green',

  // Button styles
  buttonPrimary: 'bg-everforest-green text-everforest-bg0 hover:bg-everforest-aqua focus:ring-everforest-green',
  buttonSecondary: 'bg-everforest-bg3 text-everforest-fg hover:bg-everforest-bg4 focus:ring-everforest-grey1',

  // Status badges
  statusDraft: 'bg-everforest-bg3 text-everforest-grey2',
  statusOpen: 'bg-everforest-bg-green text-everforest-green',
  statusClosed: 'bg-everforest-bg-red text-everforest-red',
  statusMerged: 'bg-everforest-bg-visual text-everforest-purple',

  // File status badges
  fileAdded: 'bg-everforest-bg-green text-everforest-green',
  fileRemoved: 'bg-everforest-bg-red text-everforest-red',
  fileModified: 'bg-everforest-bg-yellow text-everforest-yellow',
  fileRenamed: 'bg-everforest-bg-blue text-everforest-blue',

  // Text colors
  textPrimary: 'text-everforest-fg',
  textSecondary: 'text-everforest-grey2',
  textMuted: 'text-everforest-grey1',
  textLink: 'text-everforest-blue hover:text-everforest-aqua',
  textSuccess: 'text-everforest-green',
  textError: 'text-everforest-red',
  textWarning: 'text-everforest-yellow',

  // Background colors
  bgPrimary: 'bg-everforest-bg0',
  bgSecondary: 'bg-everforest-bg1',
  bgTertiary: 'bg-everforest-bg2',

  // Border colors
  border: 'border-everforest-bg3',
  borderHover: 'hover:border-everforest-bg4',

  // Loading spinner
  spinner: 'border-everforest-green',

  // Error/Alert boxes
  errorBox: 'bg-everforest-bg-red border-everforest-red',
  successBox: 'bg-everforest-bg-green border-everforest-green',
  infoBox: 'bg-everforest-bg-blue border-everforest-blue',
};
