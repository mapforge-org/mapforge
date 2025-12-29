def take_a_screenshot
  filename = Rails.root.join("tmp", "capybara", "screen-#{Time.zone.now.to_i}.png")
  puts "\033[36mINFO: Saving screenshot at: #{filename}\033[0m\n\n"
  browser = page.driver.browser
  browser.screenshot(path: filename, full: true)
end

def element_offset_height(selector)
  page.driver.browser.evaluate <<~JS
    document.querySelector('#{selector}').offsetHeight;
  JS
end
