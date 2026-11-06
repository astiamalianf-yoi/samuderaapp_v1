import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSidebar } from '../useSidebar'

describe('useSidebar', () => {
  it('starts with isOpen = false', () => {
    const { result } = renderHook(() => useSidebar())
    expect(result.current.isOpen).toBe(false)
  })

  it('toggle sets isOpen to true when it was false', () => {
    const { result } = renderHook(() => useSidebar())

    act(() => { result.current.toggle() })

    expect(result.current.isOpen).toBe(true)
  })

  it('toggle sets isOpen back to false when it was true', () => {
    const { result } = renderHook(() => useSidebar())

    act(() => { result.current.toggle() })
    act(() => { result.current.toggle() })

    expect(result.current.isOpen).toBe(false)
  })

  it('open sets isOpen to true', () => {
    const { result } = renderHook(() => useSidebar())

    act(() => { result.current.open() })

    expect(result.current.isOpen).toBe(true)
  })

  it('close sets isOpen to false', () => {
    const { result } = renderHook(() => useSidebar())

    act(() => { result.current.open() })
    act(() => { result.current.close() })

    expect(result.current.isOpen).toBe(false)
  })

  it('sets document.body.style.overflow to "hidden" when sidebar is open', () => {
    const { result } = renderHook(() => useSidebar())

    act(() => { result.current.open() })

    expect(document.body.style.overflow).toBe('hidden')
  })

  it('resets document.body.style.overflow to "" when sidebar is closed', () => {
    const { result } = renderHook(() => useSidebar())

    act(() => { result.current.open() })
    act(() => { result.current.close() })

    expect(document.body.style.overflow).toBe('')
  })

  it('restores document.body.style.overflow on unmount', () => {
    const { result, unmount } = renderHook(() => useSidebar())

    act(() => { result.current.open() })
    unmount()

    expect(document.body.style.overflow).toBe('')
  })
})
