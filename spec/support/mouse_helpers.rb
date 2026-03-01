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

# Converts a map lat/lng to browser viewport { x:, y: }
def viewport_xy_for_lat_lng(lat, lng, selector: "#maplibre-map")
  result = page.driver.browser.evaluate <<~JS
    (function() {
      var map = window.map
      var point = map.project([#{lng}, #{lat}])
      var el = document.querySelector(#{selector.to_json})
      var rect = el.getBoundingClientRect()
      return { x: rect.left + point.x, y: rect.top + point.y }
    })();
  JS
  raise "Map not ready or selector not found" if result.nil?
  { x: result["x"].round, y: result["y"].round }
end

def click_coord(_selector, x, y, button: :left)
  browser = page.driver.browser
  browser.mouse.click(x: x, y: y, button: button)
end

def hover_coord(x, y)
  browser = page.driver.browser
  browser.mouse.move(x: x, y: y)
end
