require "rails_helper"

# The test env uses the "test" cable adapter, so nothing else loads the redis
# adapter, whose `gem "redis", ">= 4", "< 6"` cap only bites at require time.
RSpec.describe ActionCable::SubscriptionAdapter do
  it "loads the redis adapter with the bundled redis version" do
    expect { require "action_cable/subscription_adapter/redis" }.not_to raise_error
  end
end
