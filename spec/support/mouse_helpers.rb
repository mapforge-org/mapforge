# 0,0 is the left top of the page
def click_coord(_selector, x, y)
  browser = page.driver.browser
  browser.mouse.click(x: x, y: y)
end

def click_center_of_screen
  viewport = page.driver.browser.evaluate <<~JS
    {
      width: window.innerWidth,
      height: window.innerHeight
    }
  JS

  center_x = viewport['width'] / 2
  center_y = viewport['height'] / 2

  page.driver.click(center_x, center_y)
end

def hover_coord(_selector, x, y)
  browser = page.driver.browser
  browser.mouse.move(x: x, y: y)
end
