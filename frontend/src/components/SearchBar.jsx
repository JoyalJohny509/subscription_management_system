import { Search } from 'lucide-react'

export default function SearchBar({ value, onChange, placeholder = 'Search records...' }) {
  return (
    <div className="search-bar">
      <span className="search-bar-icon">
        <Search size={16} strokeWidth={2} />
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  )
}
