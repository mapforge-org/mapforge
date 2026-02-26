# 0,0 is the left top of the page

def center_of_screen
  viewport = page.driver.browser.evaluate <<~JS
    { width: window.innerWidth, height: window.innerHeight }
  JS

  { x: viewport["width"] / 2, y: viewport["height"] / 2 }
end

def click_center_of_screen
  center = center_of_screen
  page.driver.click(center[:x], center[:y])
end

def hover_center_of_screen
  browser = page.driver.browser
  center = center_of_screen
  browser.mouse.move(x: center[:x], y: center[:y])
end

def click_coord(_selector, x, y)
  browser = page.driver.browser
  browser.mouse.click(x: x, y: y)
end

def hover_coord(x, y)
  browser = page.driver.browser
  browser.mouse.move(x: x, y: y)
end
