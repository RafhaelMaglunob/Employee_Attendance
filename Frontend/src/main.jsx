import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

import Dashboard from './Dashboard.jsx'
import Scheduling from './Scheduling.jsx'
import Attendance from './Attendance.jsx'
import Approval from './Approval.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
