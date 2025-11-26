require 'rails_helper'

describe ApplicationHelper do
  describe '#avatar_url' do
    it 'adds size parameter to URL without existing parameters' do
      url = 'http://example.com/avatar.png'
      expect(helper.avatar_url(url, 100)).to eq('http://example.com/avatar.png?s=100')
    end

    it 'replaces existing size parameter in URL' do
      url = 'http://example.com/avatar.png?s=50'
      expect(helper.avatar_url(url, 150)).to eq('http://example.com/avatar.png?s=150')
    end

    it 'adds size parameter to URL with other parameters' do
      url = 'http://example.com/avatar.png?foo=bar'
      expect(helper.avatar_url(url, 200)).to eq('http://example.com/avatar.png?foo=bar&s=200')
    end

    it 'replaces size parameter and keeps other parameters' do
      url = 'http://example.com/avatar.png?foo=bar&s=75&baz=qux'
      expect(helper.avatar_url(url, 300)).to eq('http://example.com/avatar.png?foo=bar&baz=qux&s=300')
    end
  end
end
