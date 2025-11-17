# screen size: 1024x860
def click_coord(element, x, y)
  page.driver.click(512 + x, 430 + y)
end

def hover_coord(element, x, y)
  page.driver.browser.mouse.move(x: 512 + x, y: 430 + y)
end
