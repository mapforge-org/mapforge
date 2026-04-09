import { isTouchDevice } from 'helpers/functions'

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

    decBtn.addEventListener('click', () => adjustValue(input, -step, stepper))
    incBtn.addEventListener('click', () => adjustValue(input, step, stepper))
  })
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
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

export function syncStepperValues () {
  document.querySelectorAll('.stepper').forEach(stepper => {
    const input = document.getElementById(stepper.dataset.stepperFor)
    if (!input) return
    stepper.querySelector('.stepper-val').textContent = formatValue(input.id, Number(input.value))
  })
}
