import { useState, useEffect, useRef } from 'react';
import { LocalNotifications } from '@capacitor/local-notifications';
import './index.css';

const App = () => {
  // Session State
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginTime, setLoginTime] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [isHoliday, setIsHoliday] = useState(false);
  
  // Settings State
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState({
    loginReminderTime: '09:00',
    weekdayLogoutHours: 9,
    saturdayLogoutHours: 4,
    backendUrl: 'https://your-backend.onrender.com', // To be updated by user
    activeDays: [1, 2, 3, 4, 5, 6], // Monday to Saturday
  });
  
  // UI State
  const [showLoginPrompt, setShowLoginPrompt] = useState(true);
  const [showLogoutReminder, setShowLogoutReminder] = useState(false);
  const [showReportPrompt, setShowReportPrompt] = useState(false);
  
  // Forms & Timers
  const [reportText, setReportText] = useState('');
  const [savedReports] = useState(['Completed daily tasks', 'Working on new feature', 'Fixed bugs in the backend']);
  const [isBackendOnline, setIsBackendOnline] = useState(true);
  const [reminderCount, setReminderCount] = useState(0);

  const timerRef = useRef(null);
  const healthCheckRef = useRef(null);

  // Load state on mount
  useEffect(() => {
    const storedSettings = localStorage.getItem('worksync_settings');
    if (storedSettings) setSettings(JSON.parse(storedSettings));

    const storedLogin = localStorage.getItem('loginTime');
    if (storedLogin) {
      setIsLoggedIn(true);
      setLoginTime(new Date(storedLogin));
      setShowLoginPrompt(false);
    }
    
    checkBackendHealth();
    healthCheckRef.current = setInterval(checkBackendHealth, 30000);

    setupNotifications();

    return () => {
      clearInterval(healthCheckRef.current);
      LocalNotifications.removeAllListeners();
    };
  }, []);

  // Sync settings changes
  useEffect(() => {
    localStorage.setItem('worksync_settings', JSON.stringify(settings));
    setupOfflineCron(); // Reschedule with new times
  }, [settings]);

  // Logout checking loop
  useEffect(() => {
    if (!isLoggedIn || !loginTime) return;
    timerRef.current = setInterval(checkLogoutCondition, 60000);
    return () => clearInterval(timerRef.current);
  }, [isLoggedIn, loginTime, reminderCount, settings]);

  const checkBackendHealth = async () => {
    try {
      const baseUrl = settings.backendUrl.replace(/\/$/, '');
      const res = await fetch(`${baseUrl}/api/health`);
      setIsBackendOnline(res.ok);
    } catch (err) {
      setIsBackendOnline(false);
    }
  };

  const setupNotifications = async () => {
    try {
      let perm = await LocalNotifications.checkPermissions();
      if (perm.display !== 'granted') await LocalNotifications.requestPermissions();

      // Register Action Buttons for Notifications
      await LocalNotifications.registerActionTypes({
        types: [
          {
            id: 'LOGIN_ACTIONS',
            actions: [
              { id: 'login', title: 'Login Now', foreground: true },
              { id: 'holiday', title: 'Mark as Holiday', foreground: true },
              { id: 'snooze', title: 'Snooze 5m', foreground: false }
            ]
          },
          {
            id: 'LOGOUT_ACTIONS',
            actions: [
              { id: 'logout', title: 'Logout Now', foreground: true },
              { id: 'snooze_out', title: 'Snooze 5m', foreground: false }
            ]
          }
        ]
      });

      // Listen for button clicks inside notifications!
      LocalNotifications.addListener('localNotificationActionPerformed', (notificationAction) => {
        const actionId = notificationAction.actionId;
        if (actionId === 'holiday') handleLogin('holiday');
        if (actionId === 'login') handleLogin('now');
        if (actionId === 'snooze') scheduleSnooze('login');
        
        if (actionId === 'logout') handleLogout(false);
        if (actionId === 'snooze_out') scheduleSnooze('logout');
      });

    } catch (e) {
      console.log('Notifications not supported here');
    }
  };

  const setupOfflineCron = async () => {
    try {
      await LocalNotifications.cancel({ notifications: [{ id: 1 }] });
      
      const [hour, minute] = settings.loginReminderTime.split(':').map(Number);
      
      // Schedule only for active days
      if (settings.activeDays.includes(new Date().getDay())) {
        await LocalNotifications.schedule({
          notifications: [{
            title: "WorkSync Daily Login",
            body: "Time to log in for the day! What would you like to do?",
            id: 1,
            schedule: { on: { hour, minute } },
            actionTypeId: 'LOGIN_ACTIONS',
            sound: null,
            attachments: null,
            extra: null
          }]
        });
      }
    } catch (e) { }
  };

  const scheduleSnooze = async (type) => {
    try {
      const snoozeId = type === 'login' ? 2 : 3;
      await LocalNotifications.schedule({
        notifications: [{
          title: type === 'login' ? "Snoozed: WorkSync Login" : "Snoozed: WorkSync Logout",
          body: "5 minute reminder!",
          id: snoozeId,
          schedule: { at: new Date(Date.now() + 5 * 60000) }, // 5 mins from now
          actionTypeId: type === 'login' ? 'LOGIN_ACTIONS' : 'LOGOUT_ACTIONS',
        }]
      });
    } catch (e) { }
  };

  const checkLogoutCondition = () => {
    const now = new Date();
    const day = now.getDay();
    if (!settings.activeDays.includes(day)) return;

    const elapsedMs = now.getTime() - new Date(loginTime).getTime();
    const targetHours = day === 6 ? settings.saturdayLogoutHours : settings.weekdayLogoutHours;
    const targetMs = targetHours * 60 * 60 * 1000;

    if (elapsedMs >= targetMs) {
      if (reminderCount < 2) {
        setShowLogoutReminder(true);
        // Trigger local notification to ring the phone
        LocalNotifications.schedule({
          notifications: [{
            title: "Time to Log Out!",
            body: `You have completed ${targetHours} hours.`,
            id: 10,
            actionTypeId: 'LOGOUT_ACTIONS'
          }]
        });
      } else {
        handleLogout(true); // Auto logout after 2 ignores
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
      scheduleSnooze('login');
      return;
    }

    setStatusMessage('Logging in...');
    try {
      const baseUrl = settings.backendUrl.replace(/\/$/, '');
      await fetch(`${baseUrl}/api/login`, { method: 'POST' });
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
      const baseUrl = settings.backendUrl.replace(/\/$/, '');
      await fetch(`${baseUrl}/api/logout`, { method: 'POST' });
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
    scheduleSnooze('logout');
  };

  const submitReport = async (text) => {
    setStatusMessage('Submitting report...');
    try {
      const baseUrl = settings.backendUrl.replace(/\/$/, '');
      await fetch(`${baseUrl}/api/report`, {
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

  const toggleDay = (day) => {
    const updated = settings.activeDays.includes(day)
      ? settings.activeDays.filter(d => d !== day)
      : [...settings.activeDays, day];
    setSettings({...settings, activeDays: updated});
  };

  const triggerTestNotification = async () => {
    try {
      await LocalNotifications.schedule({
        notifications: [{
          title: "TEST: WorkSync Daily Login",
          body: "This is a test notification. Try clicking the buttons!",
          id: 99,
          schedule: { at: new Date(Date.now() + 5000) }, // 5 seconds from now
          actionTypeId: 'LOGIN_ACTIONS'
        }]
      });
      setStatusMessage('Test notification scheduled in 5 seconds. Please close the app to see it.');
      setTimeout(() => setStatusMessage(''), 5000);
    } catch (e) {
      console.log('Error testing notification', e);
    }
  };

  return (
    <div className="app-container">
      {!isBackendOnline && (
        <div style={{ backgroundColor: 'var(--danger)', color: 'white', padding: '0.75rem', textAlign: 'center', fontWeight: 'bold' }}>
          ⚠️ Backend Offline. Update URL in Settings.
        </div>
      )}

      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', marginTop: '1rem' }}>
        <h1 style={{ margin: 0 }}>WorkSync</h1>
        <button className="btn" style={{ width: 'auto', marginBottom: 0, padding: '0.5rem' }} onClick={() => setSettingsOpen(true)}>
          ⚙️
        </button>
      </header>

      {statusMessage && (
        <div className="card pulse" style={{ padding: '0.75rem', backgroundColor: 'var(--primary-color)' }}>
          {statusMessage}
        </div>
      )}

      {/* Main Dashboard */}
      {!isLoggedIn && !isHoliday && !showLoginPrompt && (
        <div className="card flex-center">
          <h2>Ready to start?</h2>
          <button className="btn btn-primary" onClick={() => setShowLoginPrompt(true)}>Show Login Options</button>
        </div>
      )}

      {isHoliday && (
        <div className="card flex-center">
          <h2>Enjoy your Holiday! 🌴</h2>
          <button className="btn" onClick={() => setIsHoliday(false)}>Cancel Holiday Mode</button>
        </div>
      )}

      {isLoggedIn && (
        <>
          <div className="card">
            <h2>Active Session</h2>
            <p>Started: <strong>{new Date(loginTime).toLocaleTimeString()}</strong></p>
          </div>
          <div className="card">
            <button className="btn btn-primary" onClick={() => setShowReportPrompt(true)} disabled={!isBackendOnline}>Submit Report</button>
            <button className="btn btn-danger" onClick={() => handleLogout(false)} disabled={!isBackendOnline}>Manual Logout</button>
          </div>
        </>
      )}

      {/* Settings Modal */}
      {settingsOpen && (
        <div className="overlay" style={{ alignItems: 'flex-start', paddingTop: '2rem' }}>
          <div className="modal" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <h2>Settings</h2>
              <button onClick={() => setSettingsOpen(false)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.2rem' }}>✕</button>
            </div>
            
            <label style={{ display: 'block', margin: '1rem 0 0.5rem' }}>Cloud Backend URL:</label>
            <input type="text" value={settings.backendUrl} onChange={e => setSettings({...settings, backendUrl: e.target.value})} placeholder="https://your-app.onrender.com" />

            <label style={{ display: 'block', margin: '1rem 0 0.5rem' }}>Daily Login Reminder Time:</label>
            <input type="time" value={settings.loginReminderTime} onChange={e => setSettings({...settings, loginReminderTime: e.target.value})} />

            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', margin: '1rem 0 0.5rem', fontSize: '0.9rem' }}>Weekday Target (Hrs):</label>
                <input type="number" min="1" max="24" value={settings.weekdayLogoutHours} onChange={e => setSettings({...settings, weekdayLogoutHours: Number(e.target.value)})} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', margin: '1rem 0 0.5rem', fontSize: '0.9rem' }}>Saturday Target (Hrs):</label>
                <input type="number" min="1" max="24" value={settings.saturdayLogoutHours} onChange={e => setSettings({...settings, saturdayLogoutHours: Number(e.target.value)})} />
              </div>
            </div>

            <label style={{ display: 'block', margin: '1rem 0 0.5rem' }}>Active Working Days:</label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
                <button key={i} onClick={() => toggleDay(i)} className="btn" style={{ width: 'auto', padding: '0.5rem', backgroundColor: settings.activeDays.includes(i) ? 'var(--primary-color)' : 'rgba(255,255,255,0.1)' }}>
                  {d}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
              <button className="btn" style={{ width: '48%', backgroundColor: '#6c757d' }} onClick={triggerTestNotification}>
                Test Notification
              </button>
              <button className="btn btn-primary" style={{ width: '48%', margin: 0 }} onClick={() => setSettingsOpen(false)}>
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Login Prompt Modal */}
      {showLoginPrompt && !isLoggedIn && !settingsOpen && isBackendOnline && (
        <div className="overlay">
          <div className="modal">
            <h2 style={{ textAlign: 'center' }}>Good Morning!</h2>
            <button className="btn btn-success" onClick={() => handleLogin('now')} disabled={!isBackendOnline}>Login Now</button>
            <button className="btn" onClick={() => handleLogin('holiday')}>Today is a Holiday</button>
            <button className="btn" onClick={() => handleLogin('later')}>Snooze 5 mins</button>
          </div>
        </div>
      )}

      {/* Logout Reminder Modal */}
      {showLogoutReminder && !settingsOpen && (
        <div className="overlay">
          <div className="modal">
            <h2 style={{ color: 'var(--warning)', textAlign: 'center' }}>Time to Log Out!</h2>
            <p style={{ textAlign: 'center' }}>Reminder {reminderCount + 1}/2</p>
            <button className="btn btn-primary" onClick={() => setShowReportPrompt(true)} disabled={!isBackendOnline}>Write Report & Logout</button>
            <button className="btn btn-danger" onClick={() => handleLogout(false)} disabled={!isBackendOnline}>Logout Now</button>
            <button className="btn" onClick={ignoreLogoutReminder}>Snooze 5 mins</button>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {showReportPrompt && !settingsOpen && (
        <div className="overlay">
          <div className="modal">
            <h2>Submit Report</h2>
            <select onChange={(e) => e.target.value && submitReport(e.target.value)} defaultValue="">
              <option value="" disabled>Select saved report...</option>
              {savedReports.map((r, i) => <option key={i} value={r}>{r}</option>)}
            </select>
            <div style={{ textAlign: 'center', margin: '1rem 0' }}>— OR —</div>
            <textarea rows="4" placeholder="Write a new report..." value={reportText} onChange={(e) => setReportText(e.target.value)}></textarea>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button className="btn btn-primary" onClick={() => submitReport(reportText)} disabled={!reportText.trim() || !isBackendOnline}>Submit</button>
              <button className="btn" onClick={() => setShowReportPrompt(false)}>Do it Later</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
