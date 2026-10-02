def take_a_screenshot
  filename = Rails.root.join("tmp", "capybara_downloads", "screen-#{Time.zone.now.to_i}.png")
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

# Capybara cannot select in the shadow dom of the picker. The picker renders only the rows
# in view, so the entry gets searched for. Scoped to the grid: while a grid icon waits for
# its lazy src, a hover preview of the same icon keeps its own src without a click handler.
def pick_from_emoji_picker(search, selector)
  find("em-emoji-picker")
  page.execute_script(<<~JS)
    const input = document.querySelector('em-emoji-picker').shadowRoot.querySelector('input[type="search"]');
    input.value = '#{search}';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  JS
  entry = "document.querySelector('em-emoji-picker').shadowRoot.querySelector('.scroll #{selector}')"
  wait_for { page.evaluate_script("!!#{entry}") }.to be true
  page.execute_script("#{entry}.closest('button').click()")
end
