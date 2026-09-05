import { Routes, Route } from 'react-router'
import Home from './pages/Home'
import Admin from './pages/Admin'
import Audit from './pages/Audit'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/audit" element={<Audit />} />
    </Routes>
  )
}
