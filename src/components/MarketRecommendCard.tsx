import React from 'react';

interface MarketRecommendCardProps {
  marketProducts: Array<{ name: string; seedPrice: number; cashPrice: number; image: string }>;
}

export const MarketRecommendCard = ({ marketProducts }: MarketRecommendCardProps) => {
  return (
    <div className="flex-shrink-0 w-[280px] md:w-[280px] p-6 bg-[length:200%_200%] bg-gradient-to-b from-transparent to-[rgba(0,0,0,0.02)] backdrop-blur-md transition-[background-position] duration-1000 ease-in-out [background-position:top] rounded-2xl border border-[rgba(0,0,0,0.05)] hover:-translate-y-2 hover:shadow-xl transition-all duration-300">
      <div className="space-y-4">
        <div className="flex items-start space-x-3">
          <div className="flex h-8 w-8 items-center justify-center bg-green-100 rounded-full flex-shrink-0">
            🌿
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">For your Monstera:</p>
            <p className="text-xs text-muted-foreground">Curated recommendations</p>
          </div>
        </div>
        
        <div className="space-y-3">
          {marketProducts.slice(0, 2).map((product, index) => (
            <div key={index} className="flex items-start space-x-3">
              <div className="flex h-6 w-6 items-center justify-center flex-shrink-0">
                <img 
                  src={product.image} 
                  alt={product.name} 
                  className="w-full h-full object-cover rounded"
                />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">{product.name}</p>
                <div className="flex items-center space-x-2 text-xs">
                  <div className="flex items-center space-x-1">
                    <span className="flex h-3 w-3 items-center justify-center bg-green-100 rounded-full">
                      🌱
                    </span>
                    <span>{product.seedPrice}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="flex h-3 w-3 items-center justify-center bg-yellow-100 rounded-full">
                      💰
                    </span>
                    <span>{product.cashPrice}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          <div className="text-center">
            <button className="w-full flex items-center justify-center px-3 py-2 text-sm font-medium bg-[length:200%_200%] bg-gradient-to-b from-transparent to-[rgba(0,0,0,0.02)] backdrop-blur-md transition-[background-position] duration-1000 ease-in-out [background-position:top] border border-[rgba(0,0,0,0.1)] rounded-lg hover:bg-[rgba(0,0,0,0.05)] transition-all duration-200">
              View Drop →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};