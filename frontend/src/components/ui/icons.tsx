/**
 * TQI-ERP — Awwwards-tier icon library.
 *
 * Every icon used across the app lives here. They are sourced from
 * @phosphor-icons/react with `weight="light"` as the default — the
 * ultra-precise stroke that matches the Awwwards / Linear / Apple
 * editorial vocabulary. Lucide-react was the previous source; this
 * module is the single point of truth going forward.
 *
 * The `<Icon>` wrapper below applies our standard sizing + tqi-icon
 * class so consumers can just `<Icon name="Search" size={16} />`
 * without re-passing the class every time.
 */
import * as React from 'react';
import {
  // Core Lucide name → Phosphor name mapping. We import Phosphor's
  // actual names and re-export them under both Phosphor and the
  // legacy Lucide aliases below.
  WarningCircle as PhosphorWarningCircle,
  Warning as PhosphorWarning,
  ArrowLeft as PhosphorArrowLeft,
  ArrowRight as PhosphorArrowRight,
  BookOpen as PhosphorBookOpen,
  Calendar as PhosphorCalendar,
  Check as PhosphorCheck,
  CheckCircle as PhosphorCheckCircle,
  CaretDown as PhosphorCaretDown,
  CaretRight as PhosphorCaretRight,
  CaretLeft as PhosphorCaretLeft,
  CaretUp as PhosphorCaretUp,
  ClipboardText as PhosphorClipboardText,
  Clock as PhosphorClock,
  Compass as PhosphorCompass,
  DownloadSimple as PhosphorDownloadSimple,
  PencilSimple as PhosphorPencilSimple,
  Eye as PhosphorEye,
  EyeClosed as PhosphorEyeClosed,
  FileText as PhosphorFileText,
  Funnel as PhosphorFunnel,
  Info as PhosphorInfo,
  LockKey as PhosphorLockKey,
  MapPin as PhosphorMapPin,
  ChatCircle as PhosphorChatCircle,
  Monitor as PhosphorMonitor,
  Moon as PhosphorMoon,
  Plus as PhosphorPlus,
  ArrowClockwise as PhosphorArrowClockwise,
  FloppyDisk as PhosphorFloppyDisk,
  MagnifyingGlass as PhosphorMagnifyingGlass,
  PaperPlaneTilt as PhosphorPaperPlaneTilt,
  Sparkle as PhosphorSparkle,
  Star as PhosphorStar,
  Sun as PhosphorSun,
  Trash as PhosphorTrash,
  TrendUp as PhosphorTrendUp,
  UploadSimple as PhosphorUploadSimple,
  Users as PhosphorUsers,
  X as PhosphorX,
  XCircle as PhosphorXCircle,
  Bell as PhosphorBell,
  Terminal as PhosphorTerminal,
  ArrowUUpLeft as PhosphorReturnKey,
  List as PhosphorList,
  Hash as PhosphorHash,
  EnvelopeSimple as PhosphorEnvelopeSimple,
  Phone as PhosphorPhone,
  ShieldCheck as PhosphorShieldCheck,
  GraduationCap as PhosphorGraduationCap,
  Receipt as PhosphorReceipt,
  CalendarCheck as PhosphorCalendarCheck,
  DotsThreeVertical as PhosphorDotsThreeVertical,
  DotsThree as PhosphorDotsThree,
  House as PhosphorHouse,
  Gear as PhosphorGear,
  SignOut as PhosphorSignOut,
  CreditCard as PhosphorCreditCard,
  ChartLine as PhosphorChartLine,
  ChartBar as PhosphorChartBar,
  ShoppingBag as PhosphorShoppingBag,
  Wallet as PhosphorWallet,
  Bank as PhosphorBank,
  Cube as PhosphorCube,
  Buildings as PhosphorBuildings,
  Student as PhosphorStudent,
  ChalkboardTeacher as PhosphorChalkboardTeacher,
  Books as PhosphorBooks,
  Calculator as PhosphorCalculator,
  ListChecks as PhosphorListChecks,
  CheckSquare as PhosphorCheckSquare,
  Square as PhosphorSquare,
  ArrowsOut as PhosphorArrowsOut,
  ArrowsIn as PhosphorArrowsIn,
  Megaphone as PhosphorMegaphone,
  Tag as PhosphorTag,
  UserCircle as PhosphorUserCircle,
  ChartPieSlice as PhosphorChartPieSlice,
  Database as PhosphorDatabase,
  CloudArrowUp as PhosphorCloudArrowUp,
  CloudArrowDown as PhosphorCloudArrowDown,
  Globe as PhosphorGlobe,
  Lightning as PhosphorLightning,
  Key as PhosphorKey,
  Fingerprint as PhosphorFingerprint,
  LockOpen as PhosphorLockOpen,
  CalendarBlank as PhosphorCalendarBlank,
  CalendarPlus as PhosphorCalendarPlus,
  ChatText as PhosphorChatText,
  PhoneCall as PhosphorPhoneCall,
  Archive as PhosphorArchive,
  Image as PhosphorImage,
  Images as PhosphorImages,
  Camera as PhosphorCamera,
  IdentificationCard as PhosphorIdentificationCard,
  Clipboard as PhosphorClipboard,
  Pencil as PhosphorPencil,
  File as PhosphorFile,
  FilePdf as PhosphorFilePdf,
  WarningOctagon as PhosphorWarningOctagon,
  Smiley as PhosphorSmiley,
  Hourglass as PhosphorHourglass,
  Timer as PhosphorStopwatch,
  TagSimple as PhosphorTagSimple,
  Stack as PhosphorStack,
  ListNumbers as PhosphorListNumbers,
  Rows as PhosphorRows,
  Columns as PhosphorColumns,
  GridFour as PhosphorGridFour,
  SquaresFour as PhosphorSquaresFour,
  Note as PhosphorNote,
  PenNib as PhosphorPenNib,
  Path as PhosphorPath,
  CornersOut as PhosphorCornersOut,
  CornersIn as PhosphorCornersIn,
  ArrowsLeftRight as PhosphorArrowsLeftRight,
  ArrowsVertical as PhosphorArrowsUpDown,
  CaretCircleRight as PhosphorCaretCircleRight,
  CaretCircleLeft as PhosphorCaretCircleLeft,
  CaretCircleUp as PhosphorCaretCircleUp,
  CaretCircleDown as PhosphorCaretCircleDown,
  CaretDoubleRight as PhosphorCaretDoubleRight,
  CaretDoubleLeft as PhosphorCaretDoubleLeft,
  CaretUpDown as PhosphorCaretUpDown,
  FloppyDiskBack as PhosphorFloppyDiskBack,
  PaperPlaneRight as PhosphorPaperPlaneRight,
  Export as PhosphorExport,
  ShareNetwork as PhosphorShareNetwork,
  Link as PhosphorLink,
  LinkBreak as PhosphorLinkBreak,
  Power as PhosphorPower,
  WifiHigh as PhosphorWifiHigh,
  WifiSlash as PhosphorWifiSlash,
  BatteryFull as PhosphorBatteryFull,
  Flag as PhosphorFlag,
  FlagPennant as PhosphorFlagPennant,
  PushPin as PhosphorPushPin,
  ThumbsUp as PhosphorThumbsUp,
  ThumbsDown as PhosphorThumbsDown,
  Heart as PhosphorHeart,
  SmileyMeh as PhosphorSmileyMeh,
  SmileySad as PhosphorSmileySad,
  SmileyXEyes as PhosphorSmileyXEyes,
  Confetti as PhosphorConfetti,
  Rocket as PhosphorRocket,
  Wrench as PhosphorWrench,
  MagnifyingGlassPlus as PhosphorMagnifyingGlassPlus,
  MagnifyingGlassMinus as PhosphorMagnifyingGlassMinus,
  ArrowsHorizontal as PhosphorArrowsHorizontal,
  ArrowsVertical as PhosphorArrowsVertical,
  CameraRotate as PhosphorCameraRotate,
  Scan as PhosphorScan,
  Eyedropper as PhosphorEyedropper,
  Swatches as PhosphorSwatches,
  FileMagnifyingGlass as PhosphorFileMagnifyingGlass,
  Table as PhosphorTable,
  Sliders as PhosphorSliders,
  Sparkle as PhosphorSparkleRaw,
  Question as PhosphorQuestion,
  TreeStructure as PhosphorTreeStructure,
  HouseLine as PhosphorHouseLine,
  CurrencyInr as PhosphorCurrencyInr,
  UserCircleCheck as PhosphorUserCircleCheck,
  MagnifyingGlass as PhosphorMagnifyingGlassRaw,
  ArrowUUpLeft as PhosphorArrowUUpLeft,
  ArrowUp as PhosphorArrowUp,
  ArrowDown as PhosphorArrowDown,
  ArrowUpRight as PhosphorArrowUpRight,
  Pulse as PhosphorPulse,
  Circle as PhosphorCircle,
  Warning as PhosphorWarningDup,
  Crop as PhosphorCrop,
  ForkKnife as PhosphorForkKnife,
  FileCsv as PhosphorFileCsv,
  ArrowSquareOut as PhosphorArrowSquareOut,
  ArrowCounterClockwise as PhosphorArrowCounterClockwise,
  CurrencyDollar as PhosphorCurrencyDollar,
  Car as PhosphorCar,
} from '@phosphor-icons/react';

export type IconName =
  | 'AlertCircle'
  | 'AlertTriangle'
  | 'ArrowLeft'
  | 'ArrowRight'
  | 'BookOpen'
  | 'Calendar'
  | 'Check'
  | 'CheckCircle'
  | 'CheckCircle2'
  | 'ChevronDown'
  | 'ChevronRight'
  | 'ClipboardList'
  | 'Clock'
  | 'Compass'
  | 'Download'
  | 'Edit3'
  | 'Eye'
  | 'EyeOff'
  | 'FileText'
  | 'Filter'
  | 'FunnelSimple'
  | 'Info'
  | 'Lock'
  | 'MapPin'
  | 'MessageSquare'
  | 'Monitor'
  | 'Moon'
  | 'Plus'
  | 'RefreshCw'
  | 'Save'
  | 'Search'
  | 'Send'
  | 'Sparkles'
  | 'Star'
  | 'Sun'
  | 'Trash'
  | 'Trash2'
  | 'TrendingUp'
  | 'Upload'
  | 'Users'
  | 'X'
  | 'XCircle'
  | 'Bell'
  | 'Command'
  | 'CornerDownLeft'
  | 'Menu'
  | 'Hash'
  | 'Mail'
  | 'Phone'
  | 'ShieldCheck'
  | 'GraduationCap'
  | 'Receipt'
  | 'CalendarCheck'
  | 'DotsThreeVertical'
  | 'DotsThree'
  | 'CaretRight'
  | 'CaretLeft'
  | 'CaretUp'
  | 'House'
  | 'Gear'
  | 'SignOut'
  | 'CreditCard'
  | 'ChartLine'
  | 'ChartBar'
  | 'ShoppingCart'
  | 'Wallet'
  | 'Bank'
  | 'Cube'
  | 'Buildings'
  | 'Student'
  | 'ChalkboardTeacher'
  | 'Books'
  | 'Calculator'
  | 'ListChecks'
  | 'CheckSquare'
  | 'Square'
  | 'ArrowsOut'
  | 'ArrowsIn'
  | 'Close'
  | 'Megaphone'
  | 'Tag'
  | 'UserCircle'
  | 'ChartPieSlice'
  | 'Database'
  | 'CloudArrowUp'
  | 'CloudArrowDown'
  | 'Globe'
  | 'Lightning'
  | 'Key'
  | 'KeyRound'
  | 'Fingerprint'
  | 'LockOpen'
  | 'CalendarBlank'
  | 'CalendarPlus'
  | 'ChatText'
  | 'PhoneCall'
  | 'Archive'
  | 'Image'
  | 'Images'
  | 'Camera'
  | 'IdentificationCard'
  | 'Clipboard'
  | 'Pencil'
  | 'File'
  | 'FilePdf'
  | 'WarningOctagon'
  | 'Smiley'
  | 'Hourglass'
  | 'Stopwatch'
  | 'TagSimple'
  | 'Stack'
  | 'ListNumbers'
  | 'Rows'
  | 'Columns'
  | 'GridFour'
  | 'SquaresFour'
  | 'Note'
  | 'PenNib'
  | 'Path'
  | 'CornersOut'
  | 'CornersIn'
  | 'ArrowsLeftRight'
  | 'ArrowsUpDown'
  | 'CaretCircleRight'
  | 'CaretCircleLeft'
  | 'CaretCircleUp'
  | 'CaretCircleDown'
  | 'CaretDoubleRight'
  | 'CaretDoubleLeft'
  | 'CaretUpDown'
  | 'FloppyDiskBack'
  | 'PaperPlaneRight'
  | 'Export'
  | 'ShareNetwork'
  | 'Link'
  | 'LinkBreak'
  | 'Power'
  | 'WifiHigh'
  | 'WifiSlash'
  | 'BatteryFull'
  | 'Flag'
  | 'FlagPennant'
  | 'PushPin'
  | 'ThumbsUp'
  | 'ThumbsDown'
  | 'Heart'
  | 'SmileyMeh'
  | 'SmileySad'
  | 'SmileyXEyes'
  | 'Confetti'
  | 'Rocket'
  | 'Wrench'
  | 'MagnifyingGlassPlus'
  | 'MagnifyingGlassMinus'
  | 'ArrowsHorizontal'
  | 'ArrowsVertical'
  | 'CameraRotate'
  | 'Scan'
  | 'EyeDropper'
  | 'Swatches'
  | 'FileMagnifyingGlass'
  | 'Table'
  | 'Sliders'
  | 'Sparkle'
  | 'Question'
  | 'TreeStructure'
  | 'HouseLine'
  | 'CurrencyInr'
  | 'UserCircleCheck'
  | 'ClipboardText'
  | 'MagnifyingGlass'
  | 'ArrowUUpLeft'
  | 'ArrowUp'
  | 'ArrowDown'
  | 'ArrowUpRight'
  | 'Pulse'
  | 'Circle'
  | 'UploadCloud'
  | 'AlertTriangle'
  | 'Crop'
  | 'Layers'
  | 'ScanLine'
  | 'School'
  | 'Car'
  | 'Utensils'
  | 'FileSpreadsheet'
  | 'Home'
  | 'ExternalLink'
  | 'RotateCcw'
  | 'DollarSign'
  | 'CalendarDays'
  | 'Building2'
  | 'ReceiptIndianRupee';

const REGISTRY: Record<IconName, React.ComponentType<any>> = {
  AlertCircle: PhosphorWarningCircle,
  ArrowLeft: PhosphorArrowLeft,
  ArrowRight: PhosphorArrowRight,
  BookOpen: PhosphorBookOpen,
  Calendar: PhosphorCalendar,
  Check: PhosphorCheck,
  CheckCircle: PhosphorCheckCircle,
  CheckCircle2: PhosphorCheckCircle,
  ChevronDown: PhosphorCaretDown,
  ChevronRight: PhosphorCaretRight,
  ClipboardList: PhosphorClipboardText,
  Clock: PhosphorClock,
  Compass: PhosphorCompass,
  Download: PhosphorDownloadSimple,
  Edit3: PhosphorPencilSimple,
  Eye: PhosphorEye,
  EyeOff: PhosphorEyeClosed,
  FileText: PhosphorFileText,
  Filter: PhosphorFunnel,
  FunnelSimple: PhosphorFunnel,
  Info: PhosphorInfo,
  Lock: PhosphorLockKey,
  MapPin: PhosphorMapPin,
  MessageSquare: PhosphorChatCircle,
  Monitor: PhosphorMonitor,
  Moon: PhosphorMoon,
  Plus: PhosphorPlus,
  RefreshCw: PhosphorArrowClockwise,
  Save: PhosphorFloppyDisk,
  Search: PhosphorMagnifyingGlass,
  Send: PhosphorPaperPlaneTilt,
  Sparkles: PhosphorSparkle,
  Star: PhosphorStar,
  Sun: PhosphorSun,
  Trash: PhosphorTrash,
  Trash2: PhosphorTrash,
  TrendingUp: PhosphorTrendUp,
  Upload: PhosphorUploadSimple,
  Users: PhosphorUsers,
  X: PhosphorX,
  XCircle: PhosphorXCircle,
  Bell: PhosphorBell,
  Command: PhosphorTerminal,
  CornerDownLeft: PhosphorReturnKey,
  Menu: PhosphorList,
  Hash: PhosphorHash,
  Mail: PhosphorEnvelopeSimple,
  Phone: PhosphorPhone,
  ShieldCheck: PhosphorShieldCheck,
  GraduationCap: PhosphorGraduationCap,
  Receipt: PhosphorReceipt,
  CalendarCheck: PhosphorCalendarCheck,
  DotsThreeVertical: PhosphorDotsThreeVertical,
  DotsThree: PhosphorDotsThree,
  CaretRight: PhosphorCaretRight,
  CaretLeft: PhosphorCaretLeft,
  CaretUp: PhosphorCaretUp,
  House: PhosphorHouse,
  Gear: PhosphorGear,
  SignOut: PhosphorSignOut,
  CreditCard: PhosphorCreditCard,
  ChartLine: PhosphorChartLine,
  ChartBar: PhosphorChartBar,
  ShoppingCart: PhosphorShoppingBag,
  Wallet: PhosphorWallet,
  Bank: PhosphorBank,
  Cube: PhosphorCube,
  Buildings: PhosphorBuildings,
  Student: PhosphorStudent,
  ChalkboardTeacher: PhosphorChalkboardTeacher,
  Books: PhosphorBooks,
  Calculator: PhosphorCalculator,
  ListChecks: PhosphorListChecks,
  CheckSquare: PhosphorCheckSquare,
  Square: PhosphorSquare,
  ArrowsOut: PhosphorArrowsOut,
  ArrowsIn: PhosphorArrowsIn,
  Close: PhosphorX,
  Megaphone: PhosphorMegaphone,
  Tag: PhosphorTag,
  UserCircle: PhosphorUserCircle,
  ChartPieSlice: PhosphorChartPieSlice,
  Database: PhosphorDatabase,
  CloudArrowUp: PhosphorCloudArrowUp,
  CloudArrowDown: PhosphorCloudArrowDown,
  Globe: PhosphorGlobe,
  Lightning: PhosphorLightning,
  Key: PhosphorKey,
  KeyRound: PhosphorKey,
  Fingerprint: PhosphorFingerprint,
  LockOpen: PhosphorLockOpen,
  CalendarBlank: PhosphorCalendarBlank,
  CalendarPlus: PhosphorCalendarPlus,
  ChatText: PhosphorChatText,
  PhoneCall: PhosphorPhoneCall,
  Archive: PhosphorArchive,
  Image: PhosphorImage,
  Images: PhosphorImages,
  Camera: PhosphorCamera,
  IdentificationCard: PhosphorIdentificationCard,
  Clipboard: PhosphorClipboard,
  Pencil: PhosphorPencil,
  File: PhosphorFile,
  FilePdf: PhosphorFilePdf,
  WarningOctagon: PhosphorWarningOctagon,
  Smiley: PhosphorSmiley,
  Hourglass: PhosphorHourglass,
  Stopwatch: PhosphorStopwatch,
  TagSimple: PhosphorTagSimple,
  Stack: PhosphorStack,
  ListNumbers: PhosphorListNumbers,
  Rows: PhosphorRows,
  Columns: PhosphorColumns,
  GridFour: PhosphorGridFour,
  SquaresFour: PhosphorSquaresFour,
  Note: PhosphorNote,
  PenNib: PhosphorPenNib,
  Path: PhosphorPath,
  CornersOut: PhosphorCornersOut,
  CornersIn: PhosphorCornersIn,
  ArrowsLeftRight: PhosphorArrowsLeftRight,
  ArrowsUpDown: PhosphorArrowsUpDown,
  CaretCircleRight: PhosphorCaretCircleRight,
  CaretCircleLeft: PhosphorCaretCircleLeft,
  CaretCircleUp: PhosphorCaretCircleUp,
  CaretCircleDown: PhosphorCaretCircleDown,
  CaretDoubleRight: PhosphorCaretDoubleRight,
  CaretDoubleLeft: PhosphorCaretDoubleLeft,
  CaretUpDown: PhosphorCaretUpDown,
  FloppyDiskBack: PhosphorFloppyDiskBack,
  PaperPlaneRight: PhosphorPaperPlaneRight,
  Export: PhosphorExport,
  ShareNetwork: PhosphorShareNetwork,
  Link: PhosphorLink,
  LinkBreak: PhosphorLinkBreak,
  Power: PhosphorPower,
  WifiHigh: PhosphorWifiHigh,
  WifiSlash: PhosphorWifiSlash,
  BatteryFull: PhosphorBatteryFull,
  Flag: PhosphorFlag,
  FlagPennant: PhosphorFlagPennant,
  PushPin: PhosphorPushPin,
  ThumbsUp: PhosphorThumbsUp,
  ThumbsDown: PhosphorThumbsDown,
  Heart: PhosphorHeart,
  SmileyMeh: PhosphorSmileyMeh,
  SmileySad: PhosphorSmileySad,
  SmileyXEyes: PhosphorSmileyXEyes,
  Confetti: PhosphorConfetti,
  Rocket: PhosphorRocket,
  Wrench: PhosphorWrench,
  MagnifyingGlassPlus: PhosphorMagnifyingGlassPlus,
  MagnifyingGlassMinus: PhosphorMagnifyingGlassMinus,
  ArrowsHorizontal: PhosphorArrowsHorizontal,
  ArrowsVertical: PhosphorArrowsVertical,
  CameraRotate: PhosphorCameraRotate,
  Scan: PhosphorScan,
  EyeDropper: PhosphorEyedropper,
  Swatches: PhosphorSwatches,
  FileMagnifyingGlass: PhosphorFileMagnifyingGlass,
  Table: PhosphorTable,
  Sliders: PhosphorSliders,
  Sparkle: PhosphorSparkleRaw,
  Question: PhosphorQuestion,
  TreeStructure: PhosphorTreeStructure,
  HouseLine: PhosphorHouseLine,
  CurrencyInr: PhosphorCurrencyInr,
  UserCircleCheck: PhosphorUserCircleCheck,
  ClipboardText: PhosphorClipboardText,
  MagnifyingGlass: PhosphorMagnifyingGlassRaw,
  ArrowUUpLeft: PhosphorArrowUUpLeft,
  ArrowUp: PhosphorArrowUp,
  ArrowDown: PhosphorArrowDown,
  ArrowUpRight: PhosphorArrowUpRight,
  Pulse: PhosphorPulse,
  Circle: PhosphorCircle,
  UploadCloud: PhosphorCloudArrowUp,
  AlertTriangle: PhosphorWarningDup,
  Crop: PhosphorCrop,
  Layers: PhosphorStack,
  ScanLine: PhosphorScan,
  School: PhosphorGraduationCap,
  Car: PhosphorCar,
  Utensils: PhosphorForkKnife,
  FileSpreadsheet: PhosphorFileCsv,
  Home: PhosphorHouse,
  ExternalLink: PhosphorArrowSquareOut,
  RotateCcw: PhosphorArrowCounterClockwise,
  DollarSign: PhosphorCurrencyDollar,
  CalendarDays: PhosphorCalendarBlank,
  Building2: PhosphorBuildings,
  ReceiptIndianRupee: PhosphorCurrencyInr,
};

export type IconWeight = 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';

export interface IconProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> {
  name: IconName;
  /** Pixel size — width and height. Default 16. */
  size?: number;
  /** Stroke / fill weight. Default "light" for the Awwwards aesthetic. */
  weight?: IconWeight;
  /** Pass through to the svg color — defaults to currentColor. */
  color?: string;
  /** Decorative — when true, the icon is hidden from AT and given aria-hidden. */
  decorative?: boolean;
  /** Accessible label when decorative is false. */
  label?: string;
  className?: string;
}

/**
 * TQI-ERP icon — single source of truth for iconography.
 *
 * Defaults to weight="light" (the Awwwards / Linear precision look).
 * Always renders inline-flex with `line-height: 0` so it slots into
 * a 1.4rem tall row without flex gaps.
 */
export const Icon: React.FC<IconProps> = ({
  name,
  size = 16,
  weight = 'light',
  color,
  decorative = true,
  label,
  className = '',
  ...rest
}) => {
  const Component = REGISTRY[name];
  if (!Component) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn(`[TQI-Icon] Unknown icon: ${name}`);
    }
    return null;
  }
  const aria = decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': label ?? name };
  return (
    <span
      {...aria}
      {...rest}
      className={`tqi-icon ${className}`.trim()}
      style={{ display: 'inline-flex', lineHeight: 0, ...(rest.style ?? {}) }}
    >
      <Component size={size} weight={weight} color={color} />
    </span>
  );
};

/**
 * Re-export every Phosphor icon under its Phosphor name so consumers
 * can `import { MagnifyingGlass, X, Bell } from '@/components/ui/icons'`
 * and pass `size` + `weight` directly — no registry lookup needed.
 *
 * The `*Phosphor` prefix is the unique local name to avoid colliding
 * with built-in DOM/SVG names (X clashes with React's typings).
 */
export {
  PhosphorWarningCircle as WarningCircle,
  PhosphorWarningCircle as AlertCircle,
  PhosphorWarning as Warning,
  PhosphorArrowLeft as ArrowLeft,
  PhosphorArrowRight as ArrowRight,
  PhosphorBookOpen as BookOpen,
  PhosphorCalendar as Calendar,
  PhosphorCheck as Check,
  PhosphorCheckCircle as CheckCircle,
  PhosphorCheckCircle as CheckCircle2,
  PhosphorCaretDown as CaretDown,
  PhosphorCaretRight as CaretRight,
  PhosphorCaretLeft as CaretLeft,
  PhosphorCaretUp as CaretUp,
  PhosphorClipboardText as ClipboardList,
  PhosphorClock as Clock,
  PhosphorCompass as Compass,
  PhosphorDownloadSimple as Download,
  PhosphorPencilSimple as Edit3,
  PhosphorEye as Eye,
  PhosphorEyeClosed as EyeOff,
  PhosphorFileText as FileText,
  PhosphorFunnel as Filter,
  PhosphorInfo as Info,
  PhosphorLockKey as Lock,
  PhosphorMapPin as MapPin,
  PhosphorChatCircle as MessageSquare,
  PhosphorMonitor as Monitor,
  PhosphorMoon as Moon,
  PhosphorPlus as Plus,
  PhosphorArrowClockwise as RefreshCw,
  PhosphorFloppyDisk as Save,
  PhosphorMagnifyingGlass as Search,
  PhosphorPaperPlaneTilt as Send,
  PhosphorSparkle as Sparkles,
  PhosphorStar as Star,
  PhosphorSun as Sun,
  PhosphorTrash as Trash,
  PhosphorTrash as Trash2,
  PhosphorTrendUp as TrendingUp,
  PhosphorUploadSimple as Upload,
  PhosphorUsers as Users,
  PhosphorX as X,
  PhosphorXCircle as XCircle,
  PhosphorBell as Bell,
  PhosphorTerminal as Command,
  PhosphorReturnKey as CornerDownLeft,
  PhosphorList as Menu,
  PhosphorHash as Hash,
  PhosphorEnvelopeSimple as Mail,
  PhosphorPhone as Phone,
  PhosphorShieldCheck as ShieldCheck,
  PhosphorGraduationCap as GraduationCap,
  PhosphorReceipt as Receipt,
  PhosphorCalendarCheck as CalendarCheck,
  PhosphorDotsThreeVertical as DotsThreeVertical,
  PhosphorDotsThree as DotsThree,
  PhosphorCaretRight as ChevronRight,
  PhosphorCaretDown as ChevronDown,
  PhosphorHouse as House,
  PhosphorGear as Gear,
  PhosphorSignOut as SignOut,
  PhosphorCreditCard as CreditCard,
  PhosphorChartLine as ChartLine,
  PhosphorChartBar as ChartBar,
  PhosphorShoppingBag as ShoppingCart,
  PhosphorWallet as Wallet,
  PhosphorBank as Bank,
  PhosphorCube as Cube,
  PhosphorBuildings as Buildings,
  PhosphorStudent as Student,
  PhosphorChalkboardTeacher as ChalkboardTeacher,
  PhosphorBooks as Books,
  PhosphorCalculator as Calculator,
  PhosphorListChecks as ListChecks,
  PhosphorCheckSquare as CheckSquare,
  PhosphorSquare as Square,
  PhosphorArrowsOut as ArrowsOut,
  PhosphorArrowsIn as ArrowsIn,
  PhosphorX as Close,
  PhosphorMegaphone as Megaphone,
  PhosphorTag as Tag,
  PhosphorUserCircle as UserCircle,
  PhosphorChartPieSlice as ChartPieSlice,
  PhosphorDatabase as Database,
  PhosphorCloudArrowUp as CloudArrowUp,
  PhosphorCloudArrowDown as CloudArrowDown,
  PhosphorGlobe as Globe,
  PhosphorLightning as Lightning,
  PhosphorKey as Key,
  PhosphorKey as KeyRound,
  PhosphorFingerprint as Fingerprint,
  PhosphorLockOpen as LockOpen,
  PhosphorCalendarBlank as CalendarBlank,
  PhosphorCalendarPlus as CalendarPlus,
  PhosphorChatText as ChatText,
  PhosphorPhoneCall as PhoneCall,
  PhosphorArchive as Archive,
  PhosphorImage as Image,
  PhosphorImages as Images,
  PhosphorCamera as Camera,
  PhosphorIdentificationCard as IdentificationCard,
  PhosphorClipboard as Clipboard,
  PhosphorPencil as Pencil,
  PhosphorFile as File,
  PhosphorFilePdf as FilePdf,
  PhosphorWarningOctagon as WarningOctagon,
  PhosphorSmiley as Smiley,
  PhosphorHourglass as Hourglass,
  PhosphorStopwatch as Stopwatch,
  PhosphorTagSimple as TagSimple,
  PhosphorStack as Stack,
  PhosphorListNumbers as ListNumbers,
  PhosphorRows as Rows,
  PhosphorColumns as Columns,
  PhosphorGridFour as GridFour,
  PhosphorSquaresFour as SquaresFour,
  PhosphorNote as Note,
  PhosphorPenNib as PenNib,
  PhosphorPath as Path,
  PhosphorCornersOut as CornersOut,
  PhosphorCornersIn as CornersIn,
  PhosphorArrowsLeftRight as ArrowsLeftRight,
  PhosphorArrowsUpDown as ArrowsUpDown,
  PhosphorCaretCircleRight as CaretCircleRight,
  PhosphorCaretCircleLeft as CaretCircleLeft,
  PhosphorCaretCircleUp as CaretCircleUp,
  PhosphorCaretCircleDown as CaretCircleDown,
  PhosphorCaretDoubleRight as CaretDoubleRight,
  PhosphorCaretDoubleLeft as CaretDoubleLeft,
  PhosphorCaretUpDown as CaretUpDown,
  PhosphorFloppyDiskBack as FloppyDiskBack,
  PhosphorPaperPlaneRight as PaperPlaneRight,
  PhosphorExport as Export,
  PhosphorShareNetwork as ShareNetwork,
  PhosphorLink as Link,
  PhosphorLinkBreak as LinkBreak,
  PhosphorPower as Power,
  PhosphorWifiHigh as WifiHigh,
  PhosphorWifiSlash as WifiSlash,
  PhosphorBatteryFull as BatteryFull,
  PhosphorFlag as Flag,
  PhosphorFlagPennant as FlagPennant,
  PhosphorPushPin as PushPin,
  PhosphorThumbsUp as ThumbsUp,
  PhosphorThumbsDown as ThumbsDown,
  PhosphorHeart as Heart,
  PhosphorSmileyMeh as SmileyMeh,
  PhosphorSmileySad as SmileySad,
  PhosphorSmileyXEyes as SmileyXEyes,
  PhosphorConfetti as Confetti,
  PhosphorRocket as Rocket,
  PhosphorWrench as Wrench,
  PhosphorMagnifyingGlassPlus as MagnifyingGlassPlus,
  PhosphorMagnifyingGlassMinus as MagnifyingGlassMinus,
  PhosphorArrowsHorizontal as ArrowsHorizontal,
  PhosphorArrowsVertical as ArrowsVertical,
  PhosphorCameraRotate as CameraRotate,
  PhosphorScan as Scan,
  PhosphorEyedropper as EyeDropper,
  PhosphorSwatches as Swatches,
  PhosphorFileMagnifyingGlass as FileMagnifyingGlass,
  PhosphorTable as Table,
  PhosphorFunnel as FunnelSimple,
  PhosphorSliders as Sliders,
  PhosphorSparkleRaw as Sparkle,
  PhosphorQuestion as Question,
  PhosphorTreeStructure as TreeStructure,
  PhosphorHouseLine as HouseLine,
  PhosphorCurrencyInr as CurrencyInr,
  PhosphorUserCircleCheck as UserCircleCheck,
  PhosphorClipboardText as ClipboardText,
  PhosphorMagnifyingGlassRaw as MagnifyingGlass,
  PhosphorArrowUUpLeft as ArrowUUpLeft,
  PhosphorArrowUp as ArrowUp,
  PhosphorArrowDown as ArrowDown,
  PhosphorArrowUpRight as ArrowUpRight,
  PhosphorPulse as Pulse,
  PhosphorCircle as Circle,
  PhosphorCloudArrowUp as UploadCloud,
  PhosphorWarningDup as AlertTriangle,
  PhosphorCrop as Crop,
  PhosphorStack as Layers,
  PhosphorScan as ScanLine,
  PhosphorGraduationCap as School,
  PhosphorCar as Car,
  PhosphorForkKnife as Utensils,
  PhosphorFileCsv as FileSpreadsheet,
  PhosphorHouse as Home,
  PhosphorArrowSquareOut as ExternalLink,
  PhosphorArrowCounterClockwise as RotateCcw,
  PhosphorCurrencyDollar as DollarSign,
  PhosphorCalendarBlank as CalendarDays,
  PhosphorBuildings as Building2,
  PhosphorCurrencyInr as ReceiptIndianRupee,
};
