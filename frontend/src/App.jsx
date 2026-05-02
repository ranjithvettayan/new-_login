import { useState, useEffect, useRef } from 'react';
import { LocalNotifications } from '@capacitor/local-notifications';
import './index.css';

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginTime, setLoginTime] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  
  // Modals & UI State
  const [showLoginPrompt, setShowLoginPrompt] = useState(true);
  const [showLogoutReminder, setShowLogoutReminder] = useState(false);
  const [showReportPrompt, setShowReportPrompt] = useState(false);
  
  // Settings & Timers
  const [reminderCount, setReminderCount] = useState(0);
  const [reportText, setReportText] = useState('');
  const [savedReports, setSavedReports] = useState(['Completed daily tasks', 'Working on new feature', 'Fixed bugs in the backend']);
  const [isHoliday, setIsHoliday] = useState(false);
  
  // PWA & Connectivity
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showNativeInstall, setShowNativeInstall] = useState(false);
  const [showManualInstall, setShowManualInstall] = useState(false);
  const [installDismissed, setInstallDismissed] = useState(false);
  const [isBackendOnline, setIsBackendOnline] = useState(true);

  const timerRef = useRef(null);
  const healthCheckRef = useRef(null);

  // Constants
  const NINE_HOURS = 9 * 60 * 60 * 1000;
  const FOUR_HOURS = 4 * 60 * 60 * 1000;
  const REMINDER_INTERVAL = 5 * 60 * 1000; // 5 minutes

  // Detect mobile platform
  const getDevicePlatform = () => {
    const ua = navigator.userAgent || '';
    if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
    if (/android/i.test(ua)) return 'android';
    return 'desktop';
  };

  const isStandalone = () => {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  };

  const setupOfflineCron = async () => {
    try {
      let permStatus = await LocalNotifications.checkPermissions();
      if (permStatus.display !== 'granted') {
        permStatus = await LocalNotifications.requestPermissions();
      }

      if (permStatus.display === 'granted') {
        // Clear any existing crons
        await LocalNotifications.cancel({ notifications: [{ id: 1 }] });
        
        // Schedule new daily reminder for 9 AM
        await LocalNotifications.schedule({
          notifications: [
            {
              title: "WorkSync Daily Reminder",
              body: "Don't forget to log in for the day!",
              id: 1,
              schedule: { on: { hour: 9, minute: 0 } },
              sound: null,
              attachments: null,
              actionTypeId: "",
              extra: null
            }
          ]
        });
      }
    } catch (e) {
      console.log('LocalNotifications not available in browser mode');
    }
  };

  useEffect(() => {
    // Schedule the offline daily cron
    setupOfflineCron();

    // Native PWA Install Prompt (works on HTTPS / localhost)
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowNativeInstall(true);
    });

    // If on mobile, not installed, and no native prompt — show manual instructions
    const dismissed = localStorage.getItem('installDismissed');
    const platform = getDevicePlatform();
    if (platform !== 'desktop' && !isStandalone() && !dismissed) {
      setTimeout(() => setShowManualInstall(true), 2000);
    }

    const storedLogin = localStorage.getItem('loginTime');
    if (storedLogin) {
      setIsLoggedIn(true);
      setLoginTime(new Date(storedLogin));
      setShowLoginPrompt(false);
    }
    
    // Initial health check
    checkBackendHealth();

    // Health check loop
    healthCheckRef.current = setInterval(() => {
      checkBackendHealth();
    }, 15000); // Check every 15 seconds

    return () => clearInterval(healthCheckRef.current);
  }, []);

  const checkBackendHealth = async () => {
    try {
      const res = await fetch(`http://${window.location.hostname}:8000/api/health`);
      if (res.ok) {
        setIsBackendOnline(true);
      } else {
        setIsBackendOnline(false);
      }
    } catch (err) {
      setIsBackendOnline(false);
    }
  };

  useEffect(() => {
    if (!isLoggedIn || !loginTime) return;

    timerRef.current = setInterval(() => {
      checkLogoutCondition();
    }, 60000);

    return () => clearInterval(timerRef.current);
  }, [isLoggedIn, loginTime, reminderCount]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowNativeInstall(false);
    }
  };

  const dismissManualInstall = () => {
    setShowManualInstall(false);
    setInstallDismissed(true);
    localStorage.setItem('installDismissed', 'true');
  };

  const checkLogoutCondition = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const elapsed = now.getTime() - new Date(loginTime).getTime();

    if (dayOfWeek === 0) return; // Sunday

    let targetDuration = NINE_HOURS;
    if (dayOfWeek === 6) targetDuration = FOUR_HOURS; // Saturday

    if (elapsed >= targetDuration) {
      if (reminderCount < 2) {
        setShowLogoutReminder(true);
      } else {
        handleLogout(true);
      }
    }
  };

  const handleLogin = async (mode) => {
    if (mode === 'holiday') {
      setIsHoliday(true);
      setShowLoginPrompt(false);
      return;
    }
    
    if (mode === 'later') {
      setShowLoginPrompt(false);
      setTimeout(() => setShowLoginPrompt(true), 30 * 60 * 1000);
      return;
    }

    setStatusMessage('Logging in...');
    try {
      await fetch(`http://${window.location.hostname}:8000/api/login`, { method: 'POST' });
      const now = new Date();
      setLoginTime(now);
      setIsLoggedIn(true);
      setShowLoginPrompt(false);
      localStorage.setItem('loginTime', now.toISOString());
      setStatusMessage('Logged in successfully!');
      setTimeout(() => setStatusMessage(''), 3000);
    } catch (err) {
      setStatusMessage('Error: Backend Offline.');
    }
  };

  const handleLogout = async (auto = false) => {
    setStatusMessage(auto ? 'Auto-logging out...' : 'Logging out...');
    try {
      await fetch(`http://${window.location.hostname}:8000/api/logout`, { method: 'POST' });
      setIsLoggedIn(false);
      setLoginTime(null);
      setShowLogoutReminder(false);
      setReminderCount(0);
      localStorage.removeItem('loginTime');
      setStatusMessage(auto ? 'Automatically logged out.' : 'Logged out successfully!');
      setTimeout(() => setStatusMessage(''), 3000);
    } catch (err) {
      setStatusMessage('Error: Backend Offline.');
    }
  };

  const ignoreLogoutReminder = () => {
    setReminderCount(prev => prev + 1);
    setShowLogoutReminder(false);
    setTimeout(() => {
      checkLogoutCondition();
    }, REMINDER_INTERVAL);
  };

  const submitReport = async (text) => {
    setStatusMessage('Submitting report...');
    try {
      await fetch(`http://${window.location.hostname}:8000/api/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report_message: text })
      });
      setShowReportPrompt(false);
      setReportText('');
      setStatusMessage('Report submitted!');
      setTimeout(() => setStatusMessage(''), 3000);
    } catch (err) {
      setStatusMessage('Failed to submit report. Backend offline.');
    }
  };

  return (
    <div className="app-container">
      {/* Offline Banner */}
      {!isBackendOnline && (
        <div style={{
          backgroundColor: 'var(--danger)',
          color: 'white',
          padding: '0.75rem',
          textAlign: 'center',
          fontWeight: 'bold',
          borderBottomLeftRadius: '8px',
          borderBottomRightRadius: '8px',
          marginBottom: '1rem',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          animation: 'slideUp 0.3s ease-out reverse'
        }}>
          ⚠️ Backend is Offline. Cannot connect to server.
        </div>
      )}

      {/* Native PWA Install Banner (HTTPS/localhost) */}
      {showNativeInstall && (
        <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--primary-color)' }}>
          <div>
            <h3 style={{ margin: 0 }}>📲 Install WorkSync</h3>
            <p style={{ fontSize: '0.875rem', opacity: 0.9 }}>Add to home screen for quick access.</p>
          </div>
          <button className="btn" style={{ width: 'auto', marginBottom: 0, backgroundColor: 'white', color: 'var(--primary-color)' }} onClick={handleInstallClick}>
            Install App
          </button>
        </div>
      )}

      {/* Manual Install Instructions (HTTP over IP) */}
      {showManualInstall && !showNativeInstall && !installDismissed && (
        <div className="card" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <h3 style={{ margin: '0 0 0.5rem 0' }}>📲 Install as App</h3>
            <button onClick={dismissManualInstall} style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.25rem', cursor: 'pointer', padding: 0 }}>✕</button>
          </div>
          {getDevicePlatform() === 'ios' ? (
            <p style={{ fontSize: '0.875rem', lineHeight: 1.6 }}>
              Tap the <strong>Share</strong> button (📤) at the bottom of Safari, then tap <strong>"Add to Home Screen"</strong>.
            </p>
          ) : (
            <p style={{ fontSize: '0.875rem', lineHeight: 1.6 }}>
              Tap the <strong>⋮ menu</strong> (top-right in Chrome), then tap <strong>"Add to Home screen"</strong> or <strong>"Install app"</strong>.
            </p>
          )}
        </div>
      )}

      <header style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h1>WorkSync Pro</h1>
        {statusMessage && (
          <div className="card pulse" style={{ padding: '0.75rem', backgroundColor: 'var(--primary-color)' }}>
            {statusMessage}
          </div>
        )}
      </header>

      {!isLoggedIn && !isHoliday && !showLoginPrompt && (
        <div className="card flex-center">
          <h2>Ready to start your day?</h2>
          <button className="btn btn-primary" onClick={() => setShowLoginPrompt(true)}>
            Show Login Options
          </button>
        </div>
      )}

      {isHoliday && (
        <div className="card flex-center">
          <h2>Enjoy your Holiday! 🌴</h2>
          <p style={{ color: 'var(--text-muted)' }}>No tracking today.</p>
          <button className="btn" style={{ marginTop: '1rem' }} onClick={() => setIsHoliday(false)}>
            Cancel Holiday Mode
          </button>
        </div>
      )}

      {isLoggedIn && (
        <>
          <div className="card">
            <h2>Active Session</h2>
            <p>Logged in since: <strong>{new Date(loginTime).toLocaleTimeString()}</strong></p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
              Day rule: {new Date().getDay() === 0 ? 'Sunday (Manual)' : new Date().getDay() === 6 ? 'Saturday (4 hrs)' : 'Weekday (9 hrs)'}
            </p>
          </div>

          <div className="card">
            <h2>Actions</h2>
            <button className="btn btn-primary" onClick={() => setShowReportPrompt(true)} disabled={!isBackendOnline}>
              Submit Daily Report
            </button>
            <button className="btn btn-danger" onClick={() => handleLogout(false)} disabled={!isBackendOnline}>
              Manual Logout
            </button>
          </div>
        </>
      )}

      {showLoginPrompt && !isLoggedIn && (
        <div className="overlay">
          <div className="modal">
            <h2 style={{ textAlign: 'center' }}>Good Morning!</h2>
            <p style={{ textAlign: 'center', marginBottom: '1.5rem', color: 'var(--text-muted)' }}>
              Please select your login status for today.
            </p>
            <button className="btn btn-success" onClick={() => handleLogin('now')} disabled={!isBackendOnline}>
              Login Now
            </button>
            <button className="btn" onClick={() => handleLogin('holiday')}>
              Today is a Holiday
            </button>
            <button className="btn" onClick={() => handleLogin('later')}>
              Remind me Later
            </button>
          </div>
        </div>
      )}

      {showLogoutReminder && (
        <div className="overlay">
          <div className="modal">
            <h2 style={{ color: 'var(--warning)', textAlign: 'center' }}>Time to Log Out!</h2>
            <p style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              You've reached your scheduled hours for today. (Reminder {reminderCount + 1}/2)
            </p>
            <button className="btn btn-primary" onClick={() => setShowReportPrompt(true)} disabled={!isBackendOnline}>
              Write Report & Logout
            </button>
            <button className="btn btn-danger" onClick={() => handleLogout(false)} disabled={!isBackendOnline}>
              Logout Now
            </button>
            <button className="btn" onClick={ignoreLogoutReminder}>
              Remind me in 5 mins
            </button>
          </div>
        </div>
      )}

      {showReportPrompt && (
        <div className="overlay">
          <div className="modal" style={{ maxWidth: '500px' }}>
            <h2>Submit Report</h2>
            
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>Use Existing Report:</label>
              <select onChange={(e) => {
                if(e.target.value) submitReport(e.target.value);
              }} defaultValue="">
                <option value="" disabled>Select a saved report...</option>
                {savedReports.map((r, i) => (
                  <option key={i} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div style={{ textAlign: 'center', margin: '1rem 0', color: 'var(--text-muted)' }}>— OR —</div>

            <textarea 
              rows="4" 
              placeholder="Write a new report..."
              value={reportText}
              onChange={(e) => setReportText(e.target.value)}
            ></textarea>
            
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button 
                className="btn btn-primary" 
                onClick={() => submitReport(reportText)}
                disabled={!reportText.trim() || !isBackendOnline}
              >
                Submit
              </button>
              <button className="btn" onClick={() => setShowReportPrompt(false)}>
                Do it Later
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
