import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Modern soft glassmorphic Autocomplete Dropdown component.
 * Renders the menu via React Portal (document.body) so it is NEVER clipped
 * inside modals or scrollable cards ("above the card").
 * Automatically flips above the input (dropup) when space below in the card/viewport is constrained.
 */
export default function Autocomplete({
  options = [],
  value = "",
  onChange,
  placeholder = "Search or select…",
  required = false,
  disabled = false,
  allowCustom = false,
  autoFocus = false,
  placement = "auto", // "auto" | "top" | "bottom"
  className = "",
  name,
  id,
}) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Normalize options into standard format { value: string, label: string }
  const normalizedOptions = useMemo(() => {
    return options.map((opt) => {
      if (opt == null) return { value: "", label: "" };
      if (typeof opt === "object") {
        const val = String(opt.value ?? opt.name ?? opt.id ?? "");
        const lbl = String(opt.label ?? opt.name ?? opt.value ?? val);
        return { value: val, label: lbl };
      }
      const s = String(opt);
      return { value: s, label: s };
    });
  }, [options]);

  // Find the label for the currently selected value
  const selectedOption = useMemo(() => {
    return normalizedOptions.find((o) => o.value === String(value ?? "")) || null;
  }, [normalizedOptions, value]);

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  // Coords for fixed positioning in document.body
  const [coords, setCoords] = useState({
    top: 0,
    bottom: 0,
    left: 0,
    width: 0,
    openAbove: false,
  });

  // Synchronize input text with selectedOption when closed
  const displayValue = isOpen ? query : (selectedOption ? selectedOption.label : (value || ""));

  // Filter options based on user query
  const filteredOptions = useMemo(() => {
    if (!query.trim()) return normalizedOptions;
    const q = query.trim().toLowerCase();
    return normalizedOptions.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        opt.value.toLowerCase().includes(q)
    );
  }, [normalizedOptions, query]);

  // Compute fixed position and open direction (above vs below)
  const updatePosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();

    // Check boundary of parent modal if present
    const modalEl = containerRef.current.closest(".modal");
    let spaceBelowCard = window.innerHeight - rect.bottom;
    if (modalEl) {
      const modalRect = modalEl.getBoundingClientRect();
      spaceBelowCard = modalRect.bottom - rect.bottom;
    }

    const spaceBelowViewport = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    let openAbove = false;
    if (placement === "top") {
      openAbove = true;
    } else if (placement === "bottom") {
      openAbove = false;
    } else {
      // Auto: if space inside card/modal or viewport is under 230px, and there's room above, open ABOVE!
      openAbove = (spaceBelowCard < 230 || spaceBelowViewport < 230) && spaceAbove > 140;
    }

    setCoords({
      left: rect.left,
      width: rect.width,
      top: rect.bottom + 5,
      bottom: window.innerHeight - rect.top + 5,
      openAbove,
    });
  }, [placement]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    updatePosition();

    // Re-calculate on scroll or resize so portal floats strictly over the input
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen, updatePosition]);

  // Handle clicking outside to close the dropdown (checks both container and portal)
  useEffect(() => {
    const handleClickOutside = (e) => {
      const inContainer = containerRef.current && containerRef.current.contains(e.target);
      const inDropdown = dropdownRef.current && dropdownRef.current.contains(e.target);
      if (!inContainer && !inDropdown) {
        setIsOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (!isOpen || !listRef.current) return;
    const items = listRef.current.querySelectorAll(".autocomplete-item");
    const target = items[highlightedIndex];
    if (target) {
      target.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex, isOpen]);

  const notifyChange = (newVal) => {
    if (!onChange) return;
    const event = {
      target: { value: newVal, name: name || inputId },
    };
    onChange(event);
  };

  const selectOption = (opt) => {
    const newVal = opt ? opt.value : "";
    notifyChange(newVal);
    setIsOpen(false);
    setQuery("");
  };

  const handleInputChange = (e) => {
    const text = e.target.value;
    setQuery(text);
    setHighlightedIndex(0);
    if (!isOpen) {
      updatePosition();
      setIsOpen(true);
    }
    if (allowCustom) {
      notifyChange(text);
    }
  };

  const handleInputFocus = () => {
    if (disabled) return;
    setQuery("");
    updatePosition();
    setIsOpen(true);
  };

  const handleKeyDown = (e) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter") {
        e.preventDefault();
        updatePosition();
        setIsOpen(true);
        setQuery("");
        return;
      }
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < filteredOptions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : Math.max(0, filteredOptions.length - 1)
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredOptions.length > 0 && filteredOptions[highlightedIndex]) {
        selectOption(filteredOptions[highlightedIndex]);
      } else if (allowCustom && query.trim()) {
        selectOption({ value: query.trim(), label: query.trim() });
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      setQuery("");
    } else if (e.key === "Tab") {
      if (isOpen) {
        if (filteredOptions[highlightedIndex]) {
          selectOption(filteredOptions[highlightedIndex]);
        } else {
          setIsOpen(false);
          setQuery("");
        }
      }
    }
  };

  const handleClear = (e) => {
    e.stopPropagation();
    selectOption(null);
    inputRef.current?.focus();
  };

  const toggleDropdown = (e) => {
    e.stopPropagation();
    if (disabled) return;
    if (isOpen) {
      setIsOpen(false);
      setQuery("");
    } else {
      setQuery("");
      updatePosition();
      setIsOpen(true);
      inputRef.current?.focus();
    }
  };

  const dropdownPortal = isOpen
    ? createPortal(
        <div
          ref={dropdownRef}
          className={`autocomplete-portal-dropdown scroll-thin ${coords.openAbove ? "open-above" : "open-below"}`}
          style={{
            left: `${coords.left}px`,
            width: `${coords.width}px`,
            ...(coords.openAbove
              ? { bottom: `${coords.bottom}px`, top: "auto" }
              : { top: `${coords.top}px`, bottom: "auto" }),
          }}
        >
          <ul ref={listRef} className="autocomplete-list" role="listbox">
            {filteredOptions.length === 0 ? (
              <li className="autocomplete-empty">
                {query ? `No matches for "${query}"` : "No options available"}
              </li>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = opt.value === String(value ?? "");
                const isHighlighted = idx === highlightedIndex;
                return (
                  <li
                    key={`${opt.value}-${idx}`}
                    role="option"
                    aria-selected={isSelected}
                    className={`autocomplete-item ${isSelected ? "selected" : ""} ${isHighlighted ? "highlighted" : ""}`}
                    onMouseDown={(e) => {
                      e.preventDefault(); // prevent blur
                      selectOption(opt);
                    }}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                  >
                    <span className="autocomplete-item-label">{opt.label}</span>
                    {isSelected && (
                      <span className="autocomplete-check">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </span>
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>,
        document.body
      )
    : null;

  return (
    <div
      ref={containerRef}
      className={`autocomplete-wrap ${isOpen ? "is-open" : ""} ${disabled ? "is-disabled" : ""} ${className}`}
    >
      <div className="autocomplete-input-box" onClick={toggleDropdown}>
        <input
          ref={inputRef}
          id={inputId}
          name={name}
          type="text"
          className="autocomplete-input"
          value={displayValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          required={required && !value}
          disabled={disabled}
          autoFocus={autoFocus}
          autoComplete="off"
        />

        <div className="autocomplete-actions">
          {value && !disabled && (
            <button
              type="button"
              className="autocomplete-clear-btn"
              onClick={handleClear}
              title="Clear selection"
              tabIndex={-1}
            >
              ✕
            </button>
          )}
          <span
            className={`autocomplete-chevron ${isOpen ? "open" : ""}`}
            title={isOpen ? "Close menu" : "Open menu"}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </span>
        </div>
      </div>

      {dropdownPortal}
    </div>
  );
}
