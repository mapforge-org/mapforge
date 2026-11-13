require "rails_helper"

describe ActionView::Helpers::DateHelper do
  include described_class

  it "uses the dative after 'vor' in German" do
    I18n.with_locale(:de) do
      expect(time_ago_in_words(11.days.ago)).to eq "11 Tagen"
      expect(time_ago_in_words(1.day.ago)).to eq "einem Tag"
    end
  end

  it "keeps the English forms" do
    I18n.with_locale(:en) { expect(time_ago_in_words(11.days.ago)).to eq "11 days" }
  end
end
