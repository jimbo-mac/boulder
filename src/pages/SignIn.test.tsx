import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sendCode, verifyCode } from '../lib/db/auth'
import { SignIn } from './SignIn'

vi.mock('../lib/db/auth', () => ({
  sendCode: vi.fn(),
  verifyCode: vi.fn(),
}))

const mockSendCode = vi.mocked(sendCode)
const mockVerifyCode = vi.mocked(verifyCode)

function submitEmail(email: string) {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } })
  fireEvent.click(screen.getByRole('button', { name: 'Email me a code' }))
}

describe('SignIn', () => {
  beforeEach(() => {
    mockSendCode.mockReset().mockResolvedValue()
    mockVerifyCode.mockReset().mockResolvedValue()
  })

  it('sends a code to the trimmed, lower-cased email and moves to the code step', async () => {
    render(<SignIn />)
    submitEmail('  Me@Example.com ')
    expect(await screen.findByLabelText(/Code sent to/)).toBeInTheDocument()
    expect(mockSendCode).toHaveBeenCalledWith('me@example.com')
  })

  it('verifies the code, keeping digits only', async () => {
    render(<SignIn />)
    submitEmail('me@example.com')
    const codeInput = await screen.findByLabelText(/Code sent to/)
    fireEvent.change(codeInput, { target: { value: '12 34-56' } })
    expect(codeInput).toHaveValue('123456')
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    await vi.waitFor(() => expect(mockVerifyCode).toHaveBeenCalledWith('me@example.com', '123456'))
  })

  it('shows an error and stays on the email step if sending fails', async () => {
    mockSendCode.mockRejectedValue(new Error('Signups not allowed for otp'))
    render(<SignIn />)
    submitEmail('stranger@example.com')
    expect(await screen.findByRole('alert')).toHaveTextContent('Signups not allowed for otp')
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
  })

  it('shows an error if the code is wrong', async () => {
    mockVerifyCode.mockRejectedValue(new Error('Token has expired or is invalid'))
    render(<SignIn />)
    submitEmail('me@example.com')
    fireEvent.change(await screen.findByLabelText(/Code sent to/), { target: { value: '000000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Token has expired or is invalid')
  })

  it('can go back to change the email', async () => {
    render(<SignIn />)
    submitEmail('me@example.com')
    fireEvent.click(await screen.findByRole('button', { name: 'Different email' }))
    expect(screen.getByLabelText('Email')).toHaveValue('me@example.com')
  })
})
