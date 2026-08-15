require "rails_helper"

# Guards the host-resolver-rules flag in spec/support/capybara.rb. A Chrome update that drops
# the flag makes the suite depend on the network again, and this spec fails first.
describe "Network isolation" do
  before { visit root_path }

  def fetch_status(url)
    page.evaluate_async_script(<<~JS, url)
      const [url, done] = arguments
      fetch(url, { mode: 'no-cors' }).then(() => done('reached')).catch(() => done('blocked'))
    JS
  end

  it "blocks external hosts" do
    expect(fetch_status("https://cdn.jsdelivr.net/npm/easymde/dist/easymde.min.css")).to eq "blocked"
  end

  it "allows the capybara server" do
    expect(fetch_status("#{page.server.base_url}/layers/test_tile.png")).to eq "reached"
  end

  it "still answers stubbed external urls" do
    CapybaraMock.stub_request(:get, "https://example.com/stubbed").to_return(
      headers: { "Access-Control-Allow-Origin" => "*" }, status: 200, body: "ok"
    )
    expect(fetch_status("https://example.com/stubbed")).to eq "reached"
  end
end
