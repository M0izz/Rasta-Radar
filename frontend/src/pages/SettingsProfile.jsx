import { useState, useEffect } from 'react'
import { User, Bell, Map, Save, CheckCircle } from 'lucide-react'

export default function SettingsProfile() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  
  // Alert settings
  const [smsAlerts, setSmsAlerts] = useState(true)
  const [emailAlerts, setEmailAlerts] = useState(false)
  const [pushAlerts, setPushAlerts] = useState(true)
  
  const [preferredArea, setPreferredArea] = useState('All')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    // Load auth info
    const storedEmail = localStorage.getItem('rasta_user_email') || 'anonymous@rastaradar.in'
    const storedName = localStorage.getItem('rasta_user_name') || 'Anonymous Commuter'
    setEmail(storedEmail)
    setName(storedName)
    
    // Load settings from localStorage
    const savedPhone = localStorage.getItem('rasta_user_phone') || ''
    const savedSms = localStorage.getItem('rasta_settings_sms') !== 'false'
    const savedEmailAlerts = localStorage.getItem('rasta_settings_email') === 'true'
    const savedPush = localStorage.getItem('rasta_settings_push') !== 'false'
    const savedArea = localStorage.getItem('rasta_settings_area') || 'All'

    setPhone(savedPhone)
    setSmsAlerts(savedSms)
    setEmailAlerts(savedEmailAlerts)
    setPushAlerts(savedPush)
    setPreferredArea(savedArea)
  }, [])

  const handleSave = (e) => {
    e.preventDefault()
    
    localStorage.setItem('rasta_user_phone', phone)
    localStorage.setItem('rasta_settings_sms', String(smsAlerts))
    localStorage.setItem('rasta_settings_email', String(emailAlerts))
    localStorage.setItem('rasta_settings_push', String(pushAlerts))
    localStorage.setItem('rasta_settings_area', preferredArea)

    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const areas = ['All', 'Sion Circle', 'Hindmata Cinema', 'Andheri Subway', 'Kurla Depot', 'Milan Subway']

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1>Settings & Profile</h1>
        <p className="page-sub">Configure your Rasta Radar alerts, subscriptions, and profile dashboard preferences.</p>
      </div>

      {saved && (
        <div className="settings-success-alert glassmorphic">
          <CheckCircle size={16} className="text-teal" />
          <span>Settings saved successfully! Mock FCM registration updated.</span>
        </div>
      )}

      <div className="settings-grid">
        <form className="settings-form" onSubmit={handleSave}>
          
          {/* Card 1: User Profile */}
          <div className="settings-card glassmorphic">
            <div className="settings-card-header">
              <User size={18} className="text-teal" />
              <h3>User Profile</h3>
            </div>
            
            <div className="settings-field-group">
              <label>Name</label>
              <input type="text" className="settings-input" value={name} disabled />
              <span className="field-hint">Name is managed via authentication account</span>
            </div>

            <div className="settings-field-group">
              <label>Email Address</label>
              <input type="email" className="settings-input" value={email} disabled />
              <span className="field-hint">Email is managed via authentication account</span>
            </div>

            <div className="settings-field-group">
              <label htmlFor="phone">Phone Number (for SMS alarms)</label>
              <input
                id="phone"
                type="tel"
                className="settings-input"
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <span className="field-hint">Enter your mobile number to receive waterlogging alarms</span>
            </div>
          </div>

          {/* Card 2: Notifications */}
          <div className="settings-card glassmorphic">
            <div className="settings-card-header">
              <Bell size={18} className="text-teal" />
              <h3>Emergency Subscriptions</h3>
            </div>

            <div className="toggle-row">
              <div className="toggle-info">
                <h4>SMS Emergency Alerts</h4>
                <p>Receive SMS alerts when water level sensors spike in critical areas.</p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={smsAlerts}
                  onChange={(e) => setSmsAlerts(e.target.checked)}
                />
                <span className="slider"></span>
              </label>
            </div>

            <div className="toggle-row">
              <div className="toggle-info">
                <h4>Email Daily Summaries</h4>
                <p>Receive morning reports detailing monsoon rainfall forecast summaries.</p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={emailAlerts}
                  onChange={(e) => setEmailAlerts(e.target.checked)}
                />
                <span className="slider"></span>
              </label>
            </div>

            <div className="toggle-row">
              <div className="toggle-info">
                <h4>FCM Push Notifications</h4>
                <p>Receive immediate push warnings when new flood spots are reported nearby.</p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={pushAlerts}
                  onChange={(e) => setPushAlerts(e.target.checked)}
                />
                <span className="slider"></span>
              </label>
            </div>
          </div>

          {/* Card 3: Preferred Area */}
          <div className="settings-card glassmorphic">
            <div className="settings-card-header">
              <Map size={18} className="text-teal" />
              <h3>Dashboard Preferences</h3>
            </div>

            <div className="settings-field-group">
              <label htmlFor="pref-area">Preferred Monitoring Neighborhood</label>
              <select
                id="pref-area"
                className="settings-select"
                value={preferredArea}
                onChange={(e) => setPreferredArea(e.target.value)}
              >
                {areas.map((area, idx) => (
                  <option key={idx} value={area}>
                    {area === 'All' ? 'All Mumbai Regions' : area}
                  </option>
                ))}
              </select>
              <span className="field-hint">Determines the default highlighted map center and alerts sorting</span>
            </div>
          </div>

          <button type="submit" className="settings-save-btn">
            <Save size={15} style={{ marginRight: 6 }} />
            Save Preferences
          </button>
        </form>
      </div>
    </div>
  )
}
