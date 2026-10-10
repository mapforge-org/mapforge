import { isTouchDevice, debounce } from 'helpers/functions'

const formatters = {
  opacity: v => (v * 10) + '%',
  'fill-extrusion-height': v => v + 'm'
}

function formatValue (inputId, value) {
  const formatter = formatters[inputId]
  return formatter ? formatter(value) : value
}

export function initSteppers () {
  const editUi = document.getElementById('feature-edit-ui')
  if (editUi) {
    editUi.classList.toggle('touch-device', isTouchDevice())
  }

  document.querySelectorAll('.stepper').forEach(stepper => {
    if (stepper.dataset.initialized) return
    stepper.dataset.initialized = '1'

    const inputId = stepper.dataset.stepperFor
    const step = Number(stepper.dataset.stepperStep) || 1
    const input = document.getElementById(inputId)
    if (!input) return

    const decBtn = stepper.querySelector('.stepper-btn-dec')
    const incBtn = stepper.querySelector('.stepper-btn-inc')

    initRepeatButton(decBtn, () => adjustValue(input, -step, stepper))
    initRepeatButton(incBtn, () => adjustValue(input, step, stepper))
  })
}

function initRepeatButton (button, action) {
  let timer
  const stop = () => clearTimeout(timer)
  const repeat = (delay) => {
    action()
    timer = setTimeout(() => repeat(80), delay)
  }
  button.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return
    button.setPointerCapture(event.pointerId)
    repeat(400)
  })
  button.addEventListener('pointerup', stop)
  button.addEventListener('pointercancel', stop)
  button.addEventListener('lostpointercapture', stop)
  // pointerdown already handled mouse and touch, only keyboard activation (detail 0) is left
  button.addEventListener('click', (event) => { if (event.detail === 0) action() })
  button.addEventListener('contextmenu', (event) => event.preventDefault())
}

function adjustValue (input, delta, stepper) {
  const min = Number(input.min)
  const max = Number(input.max)
  const current = Number(input.value)
  const newValue = Math.min(max, Math.max(min, current + delta))
  if (newValue === current) return

  input.value = newValue
  stepper.querySelector('.stepper-val').textContent = formatValue(input.id, newValue)
  input.dispatchEvent(new Event('input', { bubbles: true }))
  // change handlers save to the server, so send only the final value of a click series
  debounce(() => input.dispatchEvent(new Event('change', { bubbles: true })), 'stepper-' + input.id, 500)
}

export function syncStepperValues () {
  document.querySelectorAll('.stepper').forEach(stepper => {
    const input = document.getElementById(stepper.dataset.stepperFor)
    if (!input) return
    stepper.querySelector('.stepper-val').textContent = formatValue(input.id, Number(input.value))
  })
}
