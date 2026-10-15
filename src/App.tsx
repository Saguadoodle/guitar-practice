import Navigation from './components/Navigation'
import FretboardPage from './pages/FretboardPage'
import SettingsPage from './pages/SettingsPage'
import JamPage from './pages/JamPage'
import ScalesPage from './pages/ScalesPage'
import ChordsPage from './pages/ChordsPage'
import PlaceholderPage from './pages/PlaceholderPage'
import { useAppSettings } from './useAppSettings'
import { useHashPage } from './useHashPage'
import { getPitch } from './pitch'
import './App.css'

export default function App() {
  const shared = useAppSettings()
  const page = useHashPage()
  const { tuning, tuningName, soundEnabled } = shared.preferences
  return <div className="app">
    <header className="site-header">
      <a className="brand" href="#/fretboard"><span className="brand-icon" aria-hidden="true">♬</span> Saguadlib <span className="brand-subtitle">GUITAR PRACTICE</span></a>
      <span className="version">一点一点，熟悉音乐。</span>
    </header>
    <Navigation current={page.id} />
    <div className="shared-summary" aria-label="全局设置摘要">
      <span>当前调弦：{tuningName}</span>
      <span className="summary-notes">6 → 1 弦：{[6, 5, 4, 3, 2, 1].map((number) => getPitch(number, 0, tuning).label).join(' · ')}</span>
      <span>声音{soundEnabled ? '开' : '关'}</span>
    </div>
    {shared.storageMessage && <p role="status" className="audio-error">{shared.storageMessage}</p>}
    <main>
      {/* 保持各页实例，返回指板时保留练习位置；hidden 同时排除键盘和无障碍访问。 */}
      <div hidden={page.id !== 'fretboard'}><FretboardPage shared={shared} active={page.id === 'fretboard'} /></div>
      <div hidden={page.id !== 'settings'}><SettingsPage shared={shared} /></div>
      <div hidden={page.id !== 'chords'}><ChordsPage shared={shared} active={page.id === 'chords'} /></div>
      <div hidden={page.id !== 'scales'}><ScalesPage shared={shared} active={page.id === 'scales'} /></div>
      <div hidden={page.id !== 'jam'}><JamPage shared={shared} active={page.id === 'jam'} /></div>
      {page.id !== 'jam' && page.id !== 'scales' && page.id !== 'fretboard' && page.id !== 'settings' && page.id !== 'chords' && <PlaceholderPage title={page.title} description={page.description} />}
    </main>
    <footer className="site-footer"><span>Saguadlib · 1145141919810</span><span>{page.title}</span></footer>
  </div>
}
