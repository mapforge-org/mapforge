def go_offline
  page.driver.execute_script("window.mapChannel.disconnected()")
  page.driver.execute_script("window.mapChannel.unsubscribe()")
end

def go_online
  page.driver.execute_script("window.mapChannel.connected()")
end

def wait_for_download(name, timeout: 10)
  Timeout.timeout(timeout) do
    loop do
      file = File.join(Capybara.save_path, name)
      return file if File.exist?(file)

      sleep 0.1
    end
  end
end

def stub_fixture(method, url, file)
  CapybaraMock.stub_request(method, url).to_return(
    headers: { "Access-Control-Allow-Origin" => "*", "Content-Type" => "application/json" },
    status: 200,
    body: File.read(Rails.root.join("spec", "fixtures", "files", file))
  )
end
