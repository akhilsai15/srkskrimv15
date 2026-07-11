/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Link,
  useLocation,
} from "react-router-dom";
import {
  Home,
  Compass,
  PlaySquare,
  MessageCircle,
  User,
  Users,
  Bell,
  Lock,
  Zap,
} from "lucide-react";
import { useAuthStore } from "./store/authStore";
import { useRetentionStore } from "./store/retentionStore";
import { useRetentionSweep } from "./hooks/useRetentionSweep";
import RetentionSetupScreen from "./screens/RetentionSetupScreen";
import { useCurrentUser } from "./hooks/useCurrentUser";
import { initCallEngine } from "./store/callStore";
import {
  useAchievementEngine,
  useTrackingStats,
} from "./lib/mock/achievementEngine";
import { BadgeCelebrationManager } from "./components/BadgeComponents";
import { RouteErrorBoundary } from "./components/RouteErrorBoundary";
import AuthScreen from "./screens/AuthScreen";
import PulseScreen from "./screens/PulseScreen";
import ConnectScreen from "./screens/ConnectScreen";
import VibesScreen from "./screens/VibesScreen";
import WorldsScreen from "./screens/WorldsScreen";
import WorldDetailScreen from "./screens/WorldDetailScreen";
import { WorldCategoryScreen } from "./screens/WorldCategoryScreen";
import MonetizationSetupScreen from "./screens/MonetizationSetupScreen";
import DiscoverScreen from "./screens/DiscoverScreen";
import OrbitScreen from "./screens/OrbitScreen";
import { WorldActivityScreen } from "./screens/WorldActivityScreen";
import { WorldSignalSettingsScreen } from "./screens/WorldSignalSettingsScreen";
import IdentityScreen from "./screens/IdentityScreen";
import SignalScreen from "./screens/SignalScreen";
import BooksScreen from "./screens/BooksScreen";
import CreatorDashboardScreen from "./screens/CreatorDashboardScreen";
import PromoteScreen from "./screens/PromoteScreen";
import MonetizationHubScreen from "./screens/MonetizationHubScreen";
import SparkDetailScreen from "./screens/SparkDetailScreen";
import PostDetailScreen from "./screens/PostDetailScreen";
import TipsManageScreen from "./screens/monetization/TipsManageScreen";
import PremiumManageScreen from "./screens/monetization/PremiumManageScreen";
import SubscriptionsManageScreen from "./screens/monetization/SubscriptionsManageScreen";
import TicketsManageScreen from "./screens/monetization/TicketsManageScreen";
import AdminDashboardScreen from "./screens/AdminDashboardScreen";
import MemberSubscriptionScreen from "./screens/MemberSubscriptionScreen";
import CreatorEarningsScreen from "./screens/CreatorEarningsScreen";
import OtherUserProfileScreen from "./screens/OtherUserProfileScreen";
import HashtagScreen from "./screens/HashtagScreen";
import ChatThreadScreen from "./screens/ChatThreadScreen";
import GroupInfoScreen from "./screens/GroupInfoScreen";
import { BottomTabs } from "./components/BottomTabs";
import TermsAgreementModal from "./components/TermsAgreementModal";
import {
  DashboardSidebar,
  MobileStatsDashboard,
  DashboardSheets,
} from "./components/DashboardSidebar";

import {
  initOnlineTracking,
  initMockUsersOnlineToggle,
} from "./hooks/useOnlineStatus";

let onlineSetupDone = false;
if (typeof window !== "undefined" && !onlineSetupDone) {
  onlineSetupDone = true;
  initOnlineTracking();
  initMockUsersOnlineToggle();
}

import { useSignalStore } from "./store/signalStore";
import { useNavigate } from "react-router-dom";

function PulseToastManager() {
  const { pulseToasts, removePulseToast } = useSignalStore();
  const navigate = useNavigate();

  if (pulseToasts.length === 0) return null;

  return (
    <div className="absolute top-4 left-4 right-4 z-[999] flex flex-col gap-2 items-center pointer-events-none">
      {pulseToasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto bg-gradient-to-r from-[#B026FF] to-[#D4AF37] p-[1px] rounded-2xl shadow-[0_0_20px_rgba(176,38,255,0.4)] animate-in slide-in-from-top-4 fade-in duration-300 w-full max-w-sm cursor-pointer active:scale-95 transition-transform"
          onClick={() => {
            removePulseToast(toast.id);
            navigate("/wallet");
          }}
        >
          <div className="bg-[#0a0a0c] rounded-2xl p-3 flex flex-col items-center text-center">
            <p className="text-[#00F0FF] font-bold text-lg mb-0.5">
              ⚡ +{toast.points} Pulse Points!
            </p>
            <p className="text-white/90 text-sm mb-1">
              {toast.message
                .replace(/\+[0-9]+ Pulse.*|\+[0-9]+ ⚡.*/, "")
                .trim()}
            </p>
            <p className="text-white/60 font-medium text-xs border-t border-white/10 pt-1 w-full mt-1">
              Total: {toast.total.toLocaleString()} ⚡
            </p>
          </div>
        </div>
      ))
      }
    </div >
  );
}

import NeonSnakeScreen from "./screens/NeonSnakeScreen";
import TicTacToeScreen from "./screens/TicTacToeScreen";
import QuizBattleScreen from "./screens/QuizBattleScreen";
import SnakesLaddersScreen from "./screens/SnakesLaddersScreen";
import VeilScreen from "./screens/VeilScreen";
import LudoGameScreen from "./screens/LudoGameScreen";
import EmojiGuessScreen from "./screens/EmojiGuessScreen";
import TruthOrDareScreen from "./screens/TruthOrDareScreen";
import KabaddiGameScreen from "./screens/KabaddiGameScreen";
import KanchaGameScreen from "./screens/KanchaGameScreen";
import GilliDandaGameScreen from "./screens/GilliDandaGameScreen";
import LagoriGameScreen from "./screens/LagoriGameScreen";
import GamesLeaderboardScreen from "./screens/GamesLeaderboardScreen";
import MafiaGameScreen from "./screens/MafiaGameScreen";
import WordChainScreen from "./screens/WordChainScreen";
import BluffQuizScreen from "./screens/BluffQuizScreen";
import BubbleShooterScreen from "./screens/BubbleShooterScreen";

import AudioCallScreen from "./components/AudioCallScreen";
import VideoCallScreen from "./components/VideoCallScreen";
import CoinWalletScreen from "./screens/CoinWalletScreen";
import SocialCalendarScreen from "./screens/SocialCalendarScreen";
import { VeilCurtain } from "./components/VeilCurtain";
import { VeilSignalManager } from "./components/VeilSignalManager";
import { StealthManager } from "./components/StealthManager";
import { VoiceRoom } from "./components/VoiceRoom";
import { MinimizedRoomBar } from "./components/MinimizedRoomBar";
import { WorldSignalBanner } from "./components/WorldSignalBanner";
import { CallErrorBanner } from "./components/CallErrorBanner";

function AppContent() {
  // Expose navigate globally so SparkViewer challenge-accept can deep-link
  const navigate = useNavigate();
  React.useEffect(() => {
    (window as any).__skrimNavigate = navigate;
    return () => { delete (window as any).__skrimNavigate; };
  }, [navigate]);

  useAchievementEngine();
  const currentUser = useCurrentUser();
  const tracking = useTrackingStats();
  const location = useLocation();

  // Connect to the real-time calling signaling server once we know who's
  // logged in, so incoming audio/video calls can ring this device.
  React.useEffect(() => {
    if (currentUser?.id) {
      initCallEngine(currentUser.id);
    }
  }, [currentUser?.id]);

  return (
    <div className="w-full h-full relative">
      <WorldSignalBanner />
      <CallErrorBanner />
      <PulseToastManager />
      <StealthManager />
      <AudioCallScreen />
      <VideoCallScreen />
      <VoiceRoom />
      <MinimizedRoomBar />
      <VeilCurtain />
      <VeilSignalManager />

      <RouteErrorBoundary key={location.pathname}>
        <Routes>
        <Route path="/" element={<PulseScreen />} />
        <Route path="/discover" element={<DiscoverScreen />} />
        <Route path="/orbit" element={<OrbitScreen />} />
        <Route path="/worlds" element={<WorldsScreen />} />
        <Route path="/worlds/activity" element={<WorldActivityScreen />} />
        <Route
          path="/worlds/category/:categoryId"
          element={<WorldCategoryScreen />}
        />
        <Route path="/world/:id" element={<WorldDetailScreen />} />
        <Route
          path="/world/:id/signals"
          element={<WorldSignalSettingsScreen />}
        />
        <Route
          path="/world/:id/monetize"
          element={<MonetizationSetupScreen />}
        />
        <Route path="/world/:id/earnings" element={<CreatorEarningsScreen />} />
        <Route
          path="/world/:id/subscription"
          element={<MemberSubscriptionScreen />}
        />
        <Route path="/games/snake" element={<NeonSnakeScreen />} />
        <Route path="/games/tictactoe" element={<TicTacToeScreen />} />
        <Route path="/games/snakesladders" element={<SnakesLaddersScreen />} />
        <Route path="/games/ludo" element={<LudoGameScreen />} />
        <Route path="/games/emoji" element={<EmojiGuessScreen />} />
        <Route path="/games/quiz" element={<QuizBattleScreen />} />
        <Route path="/games/truthdare" element={<TruthOrDareScreen />} />
        <Route path="/games/kabaddi" element={<KabaddiGameScreen />} />
        <Route path="/games/kancha" element={<KanchaGameScreen />} />
        <Route path="/games/gilli" element={<GilliDandaGameScreen />} />
        <Route path="/games/lagori" element={<LagoriGameScreen />} />
        <Route path="/games/leaderboard" element={<GamesLeaderboardScreen />} />
        <Route path="/games/mafia" element={<MafiaGameScreen />} />
        <Route path="/games/wordchain" element={<WordChainScreen />} />
        <Route path="/games/bluffquiz" element={<BluffQuizScreen />} />
        <Route path="/games/bubbleshooter" element={<BubbleShooterScreen />} />
        <Route path="/vibes" element={<VibesScreen />} />
        <Route path="/connect" element={<ConnectScreen />} />
        <Route path="/veil" element={<VeilScreen />} />
        <Route path="/chat/:id" element={<ChatThreadScreen />} />
        <Route path="/group/info" element={<GroupInfoScreen />} />
        <Route path="/identity" element={<IdentityScreen />} />
        <Route path="/books" element={<BooksScreen />} />
        <Route path="/books/:username" element={<BooksScreen />} />
        <Route path="/profile/:username" element={<OtherUserProfileScreen />} />
        <Route path="/hashtag/:tag" element={<HashtagScreen />} />
        <Route path="/signal" element={<SignalScreen />} />
        <Route path="/communities" element={<Navigate to="/worlds" replace />} />
        <Route path="/creator" element={<CreatorDashboardScreen />} />
        <Route path="/promote" element={<PromoteScreen />} />
        <Route path="/monetization" element={<MonetizationHubScreen />} />
        <Route path="/spark/:sparkId" element={<SparkDetailScreen />} />
        <Route path="/post/:postId" element={<PostDetailScreen />} />
        <Route path="/monetization/tips" element={<TipsManageScreen />} />
        <Route path="/monetization/premium" element={<PremiumManageScreen />} />
        <Route path="/monetization/subscriptions" element={<SubscriptionsManageScreen />} />
        <Route path="/monetization/tickets" element={<TicketsManageScreen />} />
        <Route path="/admin" element={<AdminDashboardScreen />} />
        <Route path="/wallet" element={<CoinWalletScreen />} />
        <Route path="/calendar" element={<SocialCalendarScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </RouteErrorBoundary>
      <BottomTabs />

      {currentUser && (
        <BadgeCelebrationManager
          stats={{
            pulseScore: tracking.pulseScore,
            blazeRun: tracking.blazeRun,
            vibeRating: parseFloat(
              localStorage.getItem("skrimchat_vibe_rating") || "9.1",
            ),
            profileViews: parseInt(
              localStorage.getItem("skrimchat_profile_views") || "892",
              10,
            ),
            followers: tracking.followers,
          }}
          username={currentUser?.username?.replace("@", "") || ""}
        />
      )}
    </div>
  );
}

function useWindowDimensions() {
  const [width, setWidth] = React.useState(window.innerWidth);
  React.useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  return { width };
}

function MainAppLayout() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const isTablet = width >= 768 && width < 1024;
  const currentUser = useCurrentUser();

  if (isDesktop) {
    return (
      <div className="w-full h-full bg-black text-white overflow-hidden flex">
        <div className="w-[80px] lg:w-[240px] hidden lg:flex flex-col h-full border-r border-[#B026FF]/30 bg-[#0A0A0A] shrink-0 z-50">
          <DashboardSidebar />
        </div>

        <div className="flex-1 h-full overflow-hidden bg-black relative">
          <AppContent />
        </div>
        <DashboardSheets />
      </div>
    );
  }

  if (isTablet) {
    return (
      <div className="w-full h-full bg-black text-white overflow-hidden flex">
        <div className="w-[240px] flex flex-col h-full border-r border-[#B026FF]/30 bg-[#0A0A0A] shrink-0 z-50">
          <DashboardSidebar />
        </div>
        <div className="flex-1 w-full bg-skrim-bg relative overflow-hidden flex flex-col">
          <AppContent />
        </div>
        <DashboardSheets />
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-hidden bg-black flex flex-col">
      <MobileStatsDashboard />
      <div className="flex-1 w-full min-h-0 relative overflow-hidden bg-skrim-bg flex flex-col">
        <AppContent />
      </div>
      <DashboardSheets />
    </div>
  );
}

export default function App() {
  const { isAuthenticated, checkSession, isLoading } = useAuthStore();
  const retentionOnboarded = useRetentionStore((s) => s.onboarded);
  useRetentionSweep(isAuthenticated && retentionOnboarded);

  React.useEffect(() => {
    checkSession();
  }, [checkSession]);

  if (isLoading) {
    return (
      <div className="w-full h-full min-h-screen bg-black flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent border-[#B026FF] animate-spin" />
          <span className="text-sm text-gray-400 font-mono tracking-wider">BOOTSTRAPPING SESSION...</span>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <TermsAgreementModal />
      {!isAuthenticated ? (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            zIndex: 9999,
          }}
          className="bg-black"
        >
          <div className="w-full h-full relative">
            <AuthScreen />
          </div>
        </div>
      ) : !retentionOnboarded ? (
        <RetentionSetupScreen onComplete={() => {}} />
      ) : (
        <MainAppLayout />
      )}
    </Router>
  );
}
