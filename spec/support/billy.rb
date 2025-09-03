require 'table_print' # Add this dependency to your gemfile

# https://github.com/oesmith/puffing-billy?tab=readme-ov-file#params
Billy.configure do |c|
  # c.record_requests = true # needed for the table output below
  c.non_successful_error_level = :error
  c.cache = true
  c.persist_cache = true
  c.cache_path = 'tmp/req_cache/'
end

# RSpec.configure do |config|
#   config.prepend_after(:example, type: :feature) do
#     puts "Requests received via Puffing Billy Proxy:"

#     puts TablePrint::Printer.table_print(Billy.proxy.requests, [
#       :status,
#       :handler,
#       :method,
#       { url: { width: 100 } },
#       :headers,
#       :body
#     ])
#   end
# end

RSpec.configure do |config|
  config.prepend_before(:suite) do
    if defined?(Billy)
      local_cache_path = Rails.root.join(Billy.config.cache_path)
      FileUtils.rm_rf(local_cache_path) if File.exist?(local_cache_path)
    end
  end
end
