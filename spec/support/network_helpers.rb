def go_offline
  page.driver.execute_script("window.mapChannel.disconnected()")
  page.driver.execute_script("window.mapChannel.unsubscribe()")
end

def go_online
  page.driver.execute_script("window.mapChannel.connected()")
end
