def take_a_screenshot
  filename = Rails.root.join("tmp", "capybara", "screen-#{Time.zone.now.to_i}.png")
  RSpec.configuration.reporter.message("\033[36mINFO: Saving screenshot at: #{filename}\033[0m\n\n")
  browser = page.driver.browser
  browser.screenshot(path: filename, full: true)
end

def element_offset_height(selector)
  page.driver.browser.evaluate <<~JS
    document.querySelector('#{selector}').offsetHeight;
  JS
end

def set_color_input(selector, color)
  color_input = find(selector)

  page.execute_script("arguments[0].value = '#{color}'", color_input)
  page.execute_script("arguments[0].dispatchEvent(new Event('input', { bubbles: true }))", color_input)
  page.execute_script("arguments[0].dispatchEvent(new Event('change', { bubbles: true }))", color_input)
end
